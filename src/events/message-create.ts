import { Message, MessageType, TextChannel, ThreadChannel } from "discord.js";
import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import { ConfigValidator } from "../lib/config-validator";
import { simpleEmbedExample } from "../lib/embeds";
import { translate } from "../lib/helpers";
import { checkWarnings } from "../lib/messages/check-warnings";
import { fetchMessages } from "../lib/messages/fetch-messages";
import { MessagesService } from "../lib/messages/messages.service";
import { HelperService } from "../lib/roles/helper.service";
import { checkDuplicateSpam } from "../lib/spam/duplicate-spam.service";
import { SpamDetectionService } from "../lib/spam/spam-detection.service";
import { ThreadService } from "../lib/threads/thread.service";
import { prisma } from "../prisma";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client,
  ): Promise<void> {
    // remove regular messages in verify channel
    // MessagesService.cleanUpVerifyChannel(message);

    const isSpam =
      await SpamDetectionService.detectSpamFirstMessageWithAi(message);
    if (isSpam) {
      return;
    }

    // check for thread start
    MessageCreate.checkThreadStart(message);

    // check for spam
    await checkDuplicateSpam(message);

    //delete messages with links
    await checkWarnings(message);

    // add Message to Database for statistics
    await MessagesService.addMessageDb(message);

    // Save thread reply to database if in a forum thread
    if (message.channel.isThread()) {
      await ThreadService.upsertReply(message);
    }

    //Leveling System
    await MessagesService.levelUpMessage(message);
  }

  static async checkThreadStart(message: Message) {
    const channel = message.channel;
    if (
      channel.isThread() &&
      channel instanceof ThreadChannel // Type guard
    ) {
      const parentChannel = message.guild?.channels.cache.get(
        channel.parentId!,
      );
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

  @SimpleCommand({ aliases: [""], prefix: ["✅", ":white_check_mark:"] })
  async checkThreadHelpLike(command: SimpleCommandMessage) {
    const message = command.message;

    const channel = message.channel;
    if (channel.isThread()) {
      const thread = await channel.fetch();
      const members = await command.message.guild?.members.fetch();
      const threadOwner = members?.get(thread.ownerId!);

      if (threadOwner?.id !== message.author.id || threadOwner?.user.bot) {
        return;
      }

      const messages = await fetchMessages(channel, 500);
      const previousMessage = messages
        .reverse()
        .find((msg) => msg.author.id !== message.author.id && !msg.author.bot);

      if (!previousMessage) return;
      if (previousMessage.author.bot) return;

      const isHelpedThread = await prisma.memberHelper.findFirst({
        where: { threadId: thread.id, threadOwnerId: thread.ownerId },
      });

      if (isHelpedThread) return;

      await prisma.memberHelper.create({
        data: {
          memberId: previousMessage.author.id,
          guildId: message.guildId!,
          threadId: thread.id,
          threadOwnerId: thread.ownerId,
        },
      });

      HelperService.helperRoleChecker(previousMessage);
    }
  }

  @SimpleCommand({ aliases: ["translate", "explain", "slate"], prefix: "/" })
  async translateReply(command: SimpleCommandMessage) {
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
}
