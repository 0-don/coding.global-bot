import { Message, MessageType, TextChannel, ThreadChannel } from "discord.js";
import type { SimpleCommandMessage } from "discordx";
import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { translate } from "@/shared/integrations/deepl";
import { checkWarnings } from "@/core/services/messages/check-warnings";
import { fetchMessages } from "@/core/services/messages/fetch-messages";
import { MessagesService } from "@/core/services/messages/messages.service";
import { HelperService } from "@/core/services/roles/helper.service";
import { checkDuplicateSpam } from "@/core/services/spam/duplicate-spam.service";
import { SpamDetectionService } from "@/core/services/spam/spam-detection.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { ConfigValidator } from "@/shared/config/validator";

export async function handleMessageCreate(message: Message): Promise<void> {
  const isSpam =
    await SpamDetectionService.detectSpamFirstMessageWithAi(message);
  if (isSpam) {
    return;
  }

  checkThreadStart(message);

  await checkDuplicateSpam(message);

  await checkWarnings(message);

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
      !parentChannel.name.includes("job") &&
      !parentChannel.name.includes("dev") &&
      !parentChannel.name.includes("showcase")
    ) {
      try {
        const firstMessage = await channel.fetchStarterMessage();
        const messages = await channel.messages.fetch();

        if (
          message.author.bot ||
          firstMessage?.author.bot ||
          messages.size > 1
        )
          return;

        if (firstMessage?.author.id === message.author.id) {
          const embed = simpleEmbedExample();
          embed.description =
            "Thanks for your question :clap:, if someone gives you an answer it would be great if you thanked them with a :white_check_mark: in response. This response will earn you both points for special roles on this server.";

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

  const thread = await channel.fetch();
  const messages = await fetchMessages(channel, 500);
  const previousMessage = messages
    .reverse()
    .find((msg) => msg.author.id !== message.author.id && !msg.author.bot);

  if (!previousMessage || previousMessage.author.bot) return;

  await HelperService.handleHelperReaction({
    threadId: thread.id,
    threadOwnerId: thread.ownerId,
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
    const channel = (await message.channel.fetch()) as TextChannel;

    const replyMsg = await channel.messages.fetch(
      message.reference?.messageId,
    );

    await message.delete();

    channel.send({
      content: await translate(
        Buffer.from(replyMsg.content, "utf-8").toString(),
      ),
      allowedMentions: { users: [], roles: [] },
    });
  }
}
