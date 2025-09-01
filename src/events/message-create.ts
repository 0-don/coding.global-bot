import { Message, MessageType, TextChannel, ThreadChannel } from "discord.js";
import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import { ConfigValidator } from "../lib/config-validator";
import { simpleEmbedExample } from "../lib/embeds";
import { translate } from "../lib/helpers";
import { checkWarnings } from "../lib/messages/check-warnings";
import { deleteUserMessages } from "../lib/messages/delete-user-messages";
import { fetchMessages } from "../lib/messages/fetch-messages";
import { MessagesService } from "../lib/messages/messages.service";
import { HelperService } from "../lib/roles/helper.service";
import { SpamDetectionService } from "../lib/spam/spam-detection.service";
import { prisma } from "../prisma";
import { UserState } from "../types/index";

const previousMessages = new Map<string, UserState>();

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client
  ): Promise<void> {
    // remove regular messages in verify channel
    // MessagesService.cleanUpVerifyChannel(message);



    const isSpam = await SpamDetectionService.detectSpam(message);
    if (isSpam) {
      await SpamDetectionService.handleSpam(message);
      return;
    }

    // check for thread start
    MessageCreate.checkThreadStart(message);

    // check for spam
    MessageCreate.checkSpam(message);

    //delete messages with links
    await checkWarnings(message);

    // add Message to Database for statistics
    await MessagesService.addMessageDb(message);

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
        channel.parentId!
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
              allowedMentions: { users: [] },
            });
          }
        } catch (_) {}
      }
    }
  }

  static async checkSpam(message: Message) {
    if (message.author.bot) return;

    if (!previousMessages.has(message.author.id)) {
      previousMessages.set(message.author.id, {
        count: 0,
        lastMessage: null,
        same: false,
        recentLinks: new Map<string, Set<string>>(),
      });
    }

    const userState = previousMessages.get(message.author.id) as UserState;

    // Helper function to check if messages have the same content and attachments
    const areMessagesIdentical = (msg1: Message, msg2: Message): boolean => {
      // Check text content
      const sameContent = msg1.content === msg2.content;

      // If both messages have no attachments, just compare content
      if (msg1.attachments.size === 0 && msg2.attachments.size === 0) {
        return sameContent;
      }

      // If one has attachments and other doesn't, they're different
      if (msg1.attachments.size !== msg2.attachments.size) {
        return false;
      }

      // At this point, both messages have attachments
      const attachments1 = Array.from(msg1.attachments.values());
      const attachments2 = Array.from(msg2.attachments.values());

      // Check if all attachments are identical by comparing URLs
      const sameAttachments = attachments1.every((att1, index) => {
        const att2 = attachments2[index];
        return att1.url === att2.url;
      });

      // Messages are identical if both content and attachments match
      return sameContent && sameAttachments;
    };

    // If there's a last message, check if it's identical to the current message
    if (
      userState.lastMessage &&
      areMessagesIdentical(userState.lastMessage, message)
    ) {
      userState.count++;
      userState.same = true;
    } else {
      // Reset count if message is different
      userState.count = 1;
      userState.same = false;
    }

    userState.lastMessage = message;

    // Take action if user has sent the same message 5 times
    if (userState.count >= 5) {
      await deleteUserMessages({
        days: 7,
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild!,
      });

      // Reset the user's state after taking action
      previousMessages.set(message.author.id, {
        count: 0,
        lastMessage: null,
        same: false,
        recentLinks: new Map<string, Set<string>>(),
      });
    }

    const linkPattern = /\[.*?\]\(https?:\/\/[^\s)]+\)|(?:https?:\/\/)[^\s]+/gi;
    const links = message.content.match(linkPattern);

    // if (links) {
    //   const currentTime = Date.now();

    //   // Clean up old entries (older than 5 minutes)
    //   if (userState.recentLinks) {
    //     for (const [link, channels] of userState.recentLinks.entries()) {
    //       if (currentTime - Number(link.split("|")[1]) > 5 * 60 * 1000) {
    //         userState.recentLinks.delete(link);
    //       }
    //     }
    //   }

    //   for (const link of links) {
    //     const linkKey = `${link}|${currentTime}`;

    //     if (!userState.recentLinks.has(linkKey)) {
    //       userState.recentLinks.set(linkKey, new Set());
    //     }

    //     const channelSet = userState.recentLinks.get(linkKey)!;

    //     // If link was already posted in this channel, ignore it
    //     if (channelSet.has(message.channel.id)) {
    //       continue;
    //     }

    //     channelSet.add(message.channel.id);

    //     // Check if the same link was posted in multiple channels
    //     let linkPostCount = 0;
    //     for (const [, channels] of userState.recentLinks) {
    //       if (channels.size > 0) {
    //         linkPostCount++;
    //       }
    //     }

    //     // If the same or similar links were posted in 3 or more channels within 5 minutes
    //     if (linkPostCount >= 3) {
    //       await deleteUserMessages({
    //         days: 7,
    //         jail: true,
    //         memberId: message.author.id,
    //         user: message.author,
    //         guild: message.guild!,
    //       });

    //       // Reset the user's state after taking action
    //       previousMessages.set(message.author.id, {
    //         count: 0,
    //         lastMessage: null,
    //         same: false,
    //         recentLinks: new Map(),
    //       });

    //       return;
    //     }
    //   }
    // }
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
        message.reference?.messageId
      );

      await message.delete();

      channel.send({
        content: await translate(
          Buffer.from(replyMsg.content, "utf-8").toString()
        ),
        allowedMentions: { users: [] },
      });
    }
  }
}
