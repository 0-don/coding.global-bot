import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { MessagesService } from "@/core/services/messages/messages.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { DuplicateSpamService } from "@/core/services/spam/duplicate-spam.service";
import { SpamDetectionService } from "@/core/services/spam/spam-detection.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { THREAD_QUESTION_RESPONSE } from "@/shared/config/branding";
import { EXCLUDED_THREAD_BOARD_TYPES } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import { translate } from "@/shared/integrations/deepl";
import { Message, MessageType, TextChannel, ThreadChannel } from "discord.js";
import type { SimpleCommandMessage } from "discordx";

export async function handleMessageCreate(message: Message): Promise<void> {
  const isSpam =
    await SpamDetectionService.detectSpamFirstMessageWithAi(message);
  if (isSpam) {
    return;
  }

  checkThreadStart(message);

  await DuplicateSpamService.checkDuplicateSpam(message);

  await MessagesService.checkWarnings(message);

  await MessagesService.addMessageDb(message);

  if (message.channel.isThread()) {
    await ThreadService.upsertReply(message);
  }

  await MessagesService.levelUpMessage(message);
}

export async function checkThreadStart(message: Message): Promise<void> {
  const channel = message.channel;
  if (channel.isThread() && channel instanceof ThreadChannel) {
    const parentChannel = message.guild?.channels.cache.get(channel.parentId!);
    if (
      parentChannel &&
      !EXCLUDED_THREAD_BOARD_TYPES.some((boardType) =>
        parentChannel.name.includes(boardType),
      )
    ) {
      try {
        const firstMessage = await channel.fetchStarterMessage();
        const messages = await channel.messages.fetch();

        if (message.author.bot || firstMessage?.author.bot || messages.size > 1)
          return;

        if (firstMessage?.author.id === message.author.id) {
          const embed = simpleEmbedExample();
          embed.description = THREAD_QUESTION_RESPONSE;

          await channel.send({
            embeds: [embed],
            allowedMentions: { users: [], roles: [] },
          });
        }
      } catch (_) {}
    }
  }
}

export async function handleCheckThreadHelpLike(
  command: SimpleCommandMessage,
): Promise<void> {
  const message = command.message;
  const channel = message.channel;

  if (!channel.isThread()) return;

  const messages = await MessagesService.fetchMessages(channel, 500);
  const previousMessage = messages
    .reverse()
    .find((msg) => msg.author.id !== message.author.id && !msg.author.bot);

  if (!previousMessage || previousMessage.author.bot) return;

  await RolesService.handleHelperReaction({
    threadId: channel.id,
    threadOwnerId: channel.ownerId,
    helperId: previousMessage.author.id,
    thankerUserId: message.author.id,
    guildId: message.guildId!,
    message: previousMessage,
  });
}

export async function handleTranslateReply(
  command: SimpleCommandMessage,
): Promise<void> {
  if (!ConfigValidator.isFeatureEnabled("DEEPL")) {
    ConfigValidator.logFeatureDisabled("Translation", "DEEPL");
    return;
  }

  const message = command.message;
  if (message.type === MessageType.Reply && message.reference?.messageId) {
    const channel = (message.channel.partial
      ? await message.channel.fetch()
      : message.channel) as TextChannel;

    const replyMsg = await channel.messages.fetch(message.reference?.messageId);

    await message.delete();

    channel.send({
      content: await translate(
        Buffer.from(replyMsg.content, "utf-8").toString(),
      ),
      allowedMentions: { users: [], roles: [] },
    });
  }
}
