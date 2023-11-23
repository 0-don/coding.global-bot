import { APIEmbed, Message, MessageType, TextChannel } from "discord.js";
import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import { askAi } from "../chatgpt/askAi.js";
import { getTextFromImage } from "../chatgpt/tesseract.js";
import { GENERAL_CHANNEL, MEMBER_ROLES } from "../lib/constants.js";
import { simpleEmbedExample } from "../lib/embeds.js";
import { translate } from "../lib/helpers.js";
import { MessagesService } from "../lib/messages/Messages.service.js";
import { checkWarnings } from "../lib/messages/checkWarnings.js";
import { deleteUserMessages } from "../lib/messages/deleteUserMessages.js";
import { fetchMessages } from "../lib/messages/fetchMessages.js";
import { HelperService } from "../lib/roles/Helper.service.js";
import { prisma } from "../prisma.js";
import { UserState } from "../types/index.js";

const previousMessages = new Map<string, UserState>();

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    // remove regular messages in verify channel
    MessagesService.cleanUpVerifyChannel(message);

    // check for thread start
    this.checkThreadStart(message);

    // check for spam
    this.checkSpam(message);

    //delete messages with links
    await checkWarnings(message);

    // add Message to Database for statistics
    await MessagesService.addMessageDb(message);
  }

  private async checkThreadStart(message: Message) {
    const channel = message.channel;
    if (channel.isThread()) {
      const firstMessage = await channel.fetchStarterMessage();
      const messages = await channel.messages.fetch();

      if (message.author.bot || firstMessage?.author.bot || messages.size > 1) return;

      if (firstMessage?.author.id === message.author.id) {
        const embed = JSON.parse(JSON.stringify(simpleEmbedExample)) as APIEmbed;
        embed.description =
          "Thanks for your question :clap:, if someone gives you an answer it would be great if you thanked them with a :white_check_mark: in response. This response will earn you both points for special roles on this server.";
        embed.footer!.text = "You can also use /ai to get help from the bot";

        await channel.send({ embeds: [embed], allowedMentions: { users: [] } });
      }
    }
  }

  private async checkSpam(message: Message) {
    if (message.author.bot) return;

    if (!previousMessages.has(message.author.id)) {
      previousMessages.set(message.author.id, {
        count: 0,
        lastMessage: null,
      });
    }

    const userState = previousMessages.get(message.author.id) as UserState;

    if (userState.count < 5) {
      if (userState.lastMessage) {
        // Überprüfen, ob die vorherige Nachricht gleich der neuen Nachricht ist
        if (userState.lastMessage.content === message.content) {
          userState.same = true;
        } else {
          userState.same = false;
        }
      }

      if (userState.same) {
        userState.count++;
      }

      userState.lastMessage = message;

      if (userState.count === 5) {
        await deleteUserMessages({
          days: 7,
          jail: true,
          memberId: message.author.id,
          user: message.author,
          guild: message.guild!,
        });

        userState.count = 0;
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
      const previousMessage = messages.reverse().find((msg) => msg.author.id !== message.author.id && !msg.author.bot);

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

  @SimpleCommand({ aliases: ["translate"], prefix: "/" })
  async translateReply(command: SimpleCommandMessage) {
    const message = command.message;
    if (message.type === MessageType.Reply && message.reference?.messageId) {
      const channel = (await message.channel.fetch()) as TextChannel;

      const replyMsg = await channel.messages.fetch(message.reference?.messageId);

      await message.delete();

      channel.send({
        content: await translate(Buffer.from(replyMsg.content, "utf-8").toString()),
        allowedMentions: { users: [] },
      });
    }
  }

  @SimpleCommand({ aliases: ["ai", "gpt"], prefix: "/" })
  async replyChatGPT(command: SimpleCommandMessage) {
    const message = command.message;
    if (message.type === MessageType.Reply && message.reference?.messageId) {
      const channel = (await message.channel.fetch()) as TextChannel;
      const replyMsg = await channel.messages.fetch(message.reference?.messageId);
      const user = message.author;

      const guildMember = await channel.guild.members.fetch(user.id);

      const channels = await channel.guild.channels.fetch();
      const botChannel = channels.find((channel) => channel?.name === "bot");

      if (
        channel.name === GENERAL_CHANNEL &&
        !guildMember?.roles.cache.some((role) => MEMBER_ROLES.includes(role.name as (typeof MEMBER_ROLES)[number]))
      ) {
        return channel.send(`use this command /ai (your text) in ${botChannel?.toString()}`);
      }

      const messages = await fetchMessages(channel, 500);
      const replyMsgIndex = messages.findIndex((msg) => msg.id === replyMsg.id);

      if (replyMsgIndex === -1) return await channel.send("Message not found");

      //delete replyMsg
      try {
        await message.delete();
      } catch (_) {}

      const userMessages: Message<boolean>[] = [replyMsg];

      // get before messages until we hit a message from a different user
      for (let i = replyMsgIndex - 1; i >= 0; i--) {
        const msg = messages[i] as Message<boolean>;
        if (msg?.author?.id === user?.id) {
          userMessages.push(msg);
        } else {
          break;
        }
      }

      // get after messages until we hit a message from a different user
      for (let i = replyMsgIndex + 1; i <= messages.length; i++) {
        const msg = messages[i] as Message<boolean>;
        if (msg?.author?.id === user?.id) {
          userMessages.push(msg);
        } else {
          break;
        }
      }

      const dateSortedMessages = userMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const getAllImagesFromMessages = (
        await Promise.all(
          dateSortedMessages
            .map((msg) => msg.attachments.map((attachment) => attachment.url))
            .flat()
            .map((url) => getTextFromImage(url)),
        )
      ).join("\n");

      const messagesContentArray = dateSortedMessages.map((msg) => msg.content);
      messagesContentArray.push(getAllImagesFromMessages);
      const messagesContent = messagesContentArray.join("\n");

      if (!messagesContent.length) return await channel.send("No messages found");

      await askAi({ channel, user, text: messagesContent });
    }
  }
}
