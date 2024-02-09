import { Message, MessageType, PartialMessage, TextChannel } from "discord.js";
import { prisma } from "../../prisma.js";
import { VERIFY_CHANNEL } from "../constants.js";

export class MessagesService {
  static async addMessageDb(message: Message<boolean>) {
    // get info
    const content = message.content;
    const memberId = message.member?.user.id;
    const channelId = message.channelId;
    const messageId = message.id;
    const guildId = message.guild?.id;

    // if info doesnt exist
    if (!content || !guildId || !memberId || message.interaction?.user.bot)
      return;

    // catch message edits
    try {
      await prisma.memberMessages.upsert({
        where: { messageId },
        create: { channelId, guildId, memberId, messageId },
        update: { channelId, guildId, memberId, messageId },
      });
    } catch (_) {}
  }

  static async deleteMessageDb(message: Message<boolean> | PartialMessage) {
    const messageId = message.id;

    if (!messageId) return;

    try {
      await prisma.memberMessages.delete({
        where: { messageId },
      });
    } catch (_) {}
  }

  static async cleanUpVerifyChannel(message: Message<boolean>) {
    const channel = (await message.channel?.fetch()) as TextChannel;
    // remove non command messages in verify channel
    if (
      VERIFY_CHANNEL.includes(channel.name) &&
      message.type !== MessageType.ChatInputCommand
    ) {
      message.delete();
    }
  }

  static async saveDeleteMessageHistory(message: Message<boolean> | PartialMessage) {
    const content = message.content;
    const memberId = message.member?.user.id;
    const channelId = message.channelId;
    const messageId = message.id;
    const guildId = message.guild?.id;

    if (!content || !guildId || !memberId || message.interaction?.user.bot)
      return;

    try {
      await prisma.memberDeletedMessages.create({
        data: { content, memberId, channelId, messageId, guildId },
      });
    } catch (_) {}
  }
}
