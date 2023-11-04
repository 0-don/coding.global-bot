import { Message, MessageType, TextChannel } from "discord.js";
import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import { GENERAL_CHANNEL, memberRoles } from "../modules/constants.js";
import { translate } from "../modules/helpers.js";
import { MessagesModule } from "../modules/messages/Messages.module.js";
import { checkWarnings } from "../modules/messages/checkWarnings.js";
import { fetchMessages } from "../modules/messages/fetchMessages.js";
import { askChatGPT } from "../utils/chatgpt/askChatGPT.js";
import { chunkedSend } from "../utils/chatgpt/chunkedSend.js";
import { getTextFromImage } from "../utils/tesseract/tesseract.js";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    // remove regular messages in verify channel
    await MessagesModule.cleanUpVerifyChannel(message);

    //delete messages with links
    await checkWarnings(message);

    // add Message to Database for statistics
    await MessagesModule.addMessageDb(message);
  }

  @SimpleCommand({ aliases: ["translate"] })
  async translateReply(command: SimpleCommandMessage) {
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
        allowedMentions: { users: [] },
      });
    }
  }

  @SimpleCommand({ aliases: ["ai", "gpt"] })
  async replyChatGPT(command: SimpleCommandMessage) {
    const message = command.message;
    if (message.type === MessageType.Reply && message.reference?.messageId) {
      const channel = (await message.channel.fetch()) as TextChannel;
      const replyMsg = await channel.messages.fetch(
        message.reference?.messageId,
      );
      const user = message.author;

      const guildMember = await channel.guild.members.fetch(user.id);

      const channels = await channel.guild.channels.fetch();
      const botChannel = channels.find((channel) => channel?.name === "bot");

      if (
        channel.name === GENERAL_CHANNEL &&
        !guildMember?.roles.cache.some((role) =>
          memberRoles.includes(role.name.toLowerCase()),
        )
      ) {
        return channel.send(
          `use this command /ai (your text) in ${botChannel?.toString()}`,
        );
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

      const dateSortedMessages = userMessages.sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp,
      );

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

      if (!messagesContent.length)
        return await channel.send("No messages found");

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
