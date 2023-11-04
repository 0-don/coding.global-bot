import { Message, MessageType, PartialMessage, TextChannel } from "discord.js";
import { prisma } from "../../prisma.js";
import { VERIFY_CHANNEL } from "../constants.js";

export class MessagesService {
  static async addMessageDb(message: Message<boolean>) {
    // check if disboard bump command was used

    // get info
    const content = message.content;
    const memberId = message.member?.user.id;
    const channelId = message.channelId;
    const messageId = message.id;
    const guildId = message.guild?.id;

    // if info doesnt exist
    if (!content || !guildId || !memberId || message.interaction?.user.bot) return;

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
    // get info
    const messageId = message.id;

    // if info doesnt exist
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
    if (channel.name === VERIFY_CHANNEL && message.type !== MessageType.ChatInputCommand) {
      message.delete();
    }
  }
}
