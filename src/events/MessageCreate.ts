import { Message, MessageType, TextChannel } from "discord.js";
import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import { askChatGPT } from "../chatgpt/askChatGPT.js";
import { chunkedSend } from "../chatgpt/chunkedSend.js";
import { getTextFromImage } from "../chatgpt/tesseract.js";
import { GENERAL_CHANNEL, MEMBER_ROLES } from "../lib/constants.js";
import { translate } from "../lib/helpers.js";
import { MessagesService } from "../lib/messages/Messages.service.js";
import { checkWarnings } from "../lib/messages/checkWarnings.js";
import { fetchMessages } from "../lib/messages/fetchMessages.js";
import { HelperService } from "../lib/roles/Helper.service.js";
import { prisma } from "../prisma.js";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    // remove regular messages in verify channel
    MessagesService.cleanUpVerifyChannel(message);

    //delete messages with links
    await checkWarnings(message);

    // add Message to Database for statistics
    await MessagesService.addMessageDb(message);
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
      const previousMessage = messages.reverse().find((msg) => msg.author.id !== message.author.id);

      if (!previousMessage) return;

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
      await message.delete();

      const userMessages: Message<boolean>[] = [replyMsg];

      // get before messages until we hit a message from a different user
      for (let i = replyMsgIndex - 1; i >= 0; i--) {
        const msg = messages[i] as Message<boolean>;
        if (msg.author.id === user.id) {
          userMessages.push(msg);
        } else {
          break;
        }
      }

      // get after messages until we hit a message from a different user
      for (let i = replyMsgIndex + 1; i <= messages.length; i++) {
        const msg = messages[i] as Message<boolean>;
        if (msg.author.id === user.id) {
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

      const content = await askChatGPT({
        text: messagesContent,
        user,
        reply: true,
      });

      if (!content) return await channel.send("Chat GPT failed");

      return await chunkedSend({
        content,
        channel: message.channel as TextChannel,
      });
    }
  }
}
