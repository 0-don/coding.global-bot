import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import {
  templateValidationDmEmbed,
  templateValidationNotificationEmbed
} from "@/core/embeds/template-validation.embed";
import { AiTemplateService } from "@/core/services/ai/ai-template.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { botLogger } from "@/lib/telemetry";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import type { TemplateValidationResult } from "@/types";
import { getThreadWelcomeMessage } from "@/shared/config/branding";
import { TEMPLATE_VALIDATION_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import type { AnyThreadChannel } from "discord.js";
import { ChannelType, TextChannel, ThreadChannel } from "discord.js";

const VALIDATED_BOARDS: ValidatedBoardType[] = ["job-board", "dev-board"];

function isValidatedBoard(type: string): type is ValidatedBoardType {
  return VALIDATED_BOARDS.includes(type as ValidatedBoardType);
}

export async function handleThreadCreate(
  thread: AnyThreadChannel,
  newlyCreated: boolean
): Promise<void> {
  if (
    !thread.parent ||
    thread.parent.type !== ChannelType.GuildForum ||
    !(thread instanceof ThreadChannel)
  ) {
    return;
  }

  const threadType = ThreadService.getThreadTypeFromChannel(thread.parent);

  await ThreadService.upsertTags(thread.guildId, thread.parent.availableTags);

  await ThreadService.upsertThread(thread, threadType, { syncMessages: true });

  if (newlyCreated) {
    if (isValidatedBoard(threadType)) {
      const isValid = await validateForumPost(thread, threadType);
      if (!isValid) return;
    }

    try {
      const embed = simpleEmbedExample();
      embed.description = getThreadWelcomeMessage(
        threadType,
        thread.id,
        thread.name
      );
      embed.footer!.text = threadType;

      await thread.send({
        embeds: [embed],
        allowedMentions: { users: [], roles: [] }
      });
    } catch (_) {}
  }
}

async function validateForumPost(
  thread: ThreadChannel,
  boardType: ValidatedBoardType
): Promise<boolean> {
  if (!ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY")) {
    botLogger.info("[TemplateValidation] Skipped, AI key not configured");
    return true;
  }

  try {
    const starterMessage = await thread.fetchStarterMessage();
    if (!starterMessage) {
      botLogger.info("[TemplateValidation] Skipped, no starter message", {
        threadId: thread.id
      });
      return true;
    }

    const postContent = starterMessage.content;
    if (!postContent.trim()) {
      botLogger.info("[TemplateValidation] Skipped, empty post content", {
        threadId: thread.id
      });
      return true;
    }

    const parent = thread.parent;
    if (!parent || parent.type !== ChannelType.GuildForum) return true;

    const availableTagNames = parent.availableTags.map((t) => t.name);
    const appliedTagNames = thread.appliedTags
      .map((tagId) => parent.availableTags.find((t) => t.id === tagId)?.name)
      .filter(Boolean) as string[];

    botLogger.info("[TemplateValidation] Validating post", {
      threadId: thread.id,
      threadName: thread.name,
      boardType,
      contentLength: postContent.length,
      appliedTags: appliedTagNames
    });

    const result = await AiTemplateService.validatePost(
      boardType,
      thread.name,
      postContent,
      appliedTagNames,
      availableTagNames
    );

    if (!result) {
      botLogger.warn("[TemplateValidation] AI returned null, allowing post", {
        threadId: thread.id
      });
      return true;
    }

    const extractedFieldCount = Object.keys(result.extractedFields).length;

    botLogger.info("[TemplateValidation] AI result", {
      threadId: thread.id,
      threadName: thread.name,
      boardType,
      isValid: result.isValid,
      missingFields: result.missingFields,
      suggestions: result.suggestions,
      extractedFieldCount,
      extractedFieldKeys: Object.keys(result.extractedFields),
      extractedFields: result.extractedFields
    });

    if (result.isValid) return true;

    const ownerId = thread.ownerId;
    if (ownerId) {
      let dmSent = false;
      let username = "unknown";
      let displayName = "Unknown";

      try {
        const owner = await thread.guild.members.fetch(ownerId);
        username = owner.user.username;
        displayName = owner.displayName;
        await owner.send({
          embeds: [
            templateValidationDmEmbed({
              postTitle: thread.name,
              boardType,
              postContent,
              result
            })
          ]
        });
        dmSent = true;
      } catch (dmError) {
        botLogger.warn("[TemplateValidation] Failed to DM user", {
          ownerId,
          error: String(dmError)
        });
      }

      botLogger.info("[TemplateValidation] Removing invalid post", {
        threadId: thread.id,
        threadName: thread.name,
        ownerId,
        dmSent,
        missingFields: result.missingFields
      });

      await sendNotification(thread, boardType, ownerId, username, displayName, result);
    }

    try {
      await thread.delete(
        "Template validation failed: missing required fields"
      );
    } catch (deleteError) {
      botLogger.error("[TemplateValidation] Failed to delete thread", {
        threadId: thread.id,
        error: String(deleteError)
      });
    }

    return false;
  } catch (error) {
    botLogger.error("[TemplateValidation] Unexpected error, allowing post", {
      threadId: thread.id,
      error: String(error)
    });
    return true;
  }
}

async function sendNotification(
  thread: ThreadChannel,
  boardType: ValidatedBoardType,
  memberId: string,
  username: string,
  displayName: string,
  result: TemplateValidationResult,
): Promise<void> {
  if (!ConfigValidator.isFeatureEnabled("TEMPLATE_VALIDATION_CHANNELS")) {
    return;
  }

  try {
    const notificationChannel = thread.guild.channels.cache.find(
      (ch) => ch.isTextBased() && TEMPLATE_VALIDATION_CHANNELS.includes(ch.name)
    );

    if (!notificationChannel || !notificationChannel.isTextBased()) return;

    await (notificationChannel as TextChannel).send({
      embeds: [
        templateValidationNotificationEmbed({
          memberId,
          username,
          displayName,
          postTitle: thread.name,
          boardType,
          missingFields: result.missingFields,
          summary: result.summary,
          scamRisk: result.scamRisk,
          scamReason: result.scamReason,
        })
      ],
      allowedMentions: { users: [], roles: [] }
    });
  } catch (_) {}
}
