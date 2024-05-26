import {
  AuditLogEvent,
  Message,
  MessageType,
  PartialMessage,
  TextChannel,
} from "discord.js";
import { prisma } from "../../prisma.js";
import {
  ACTIVE,
  GIGA_ACTIVE,
  MEGA_ACTIVE,
  SHOULD_USER_LEVEL_UP,
  SUPER_ACTIVE,
  ULTRA_ACTIVE,
  VERIFY_CHANNELS,
} from "../constants.js";
import { count } from "console";

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
      VERIFY_CHANNELS.includes(channel.name) &&
      message.type !== MessageType.ChatInputCommand
    ) {
      message.delete();
    }
  }

  static async saveDeletedMessageHistory(
    message: Message<boolean> | PartialMessage
  ) {
    const content = message.content;
    const channelId = message.channelId;
    const messageId = message.id;
    const guildId = message.guild?.id;

    if (
      !content ||
      !guildId ||
      !message.member?.user?.id ||
      message.interaction?.user.bot
    )
      return;

    const messageMemberId = message.member?.user?.id;
    let deletedByMemberId = messageMemberId;

    try {
      const auditLogs = await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 1,
      });
      const deleteLog = auditLogs.entries.first();

      if (deleteLog) {
        const { executor, target, extra, createdTimestamp } = deleteLog;

        const timeDiff = Date.now() - createdTimestamp;

        if (
          timeDiff < 5000 &&
          (extra?.count ?? 0) >= 1 &&
          target?.id === messageMemberId
        ) {
          deletedByMemberId = executor?.id ?? messageMemberId;
        }
      }

      await prisma.memberDeletedMessages.create({
        data: {
          content,
          deletedByMemberId,
          messageMemberId,
          channelId,
          messageId,
          guildId,
        },
      });
    } catch (_) {}
  }

  static async levelUpMessage(message: Message<boolean>) {
    const LIST = [
      { count: 10, role: ACTIVE },
      { count: 100, role: SUPER_ACTIVE },
      { count: 1000, role: MEGA_ACTIVE },
      { count: 2500, role: GIGA_ACTIVE },
      { count: 5000, role: ULTRA_ACTIVE },
    ];

    const memberId = message.member?.id;
    const guildId = message.guild?.id;

    const memberMessages = await prisma.memberMessages.count({
      where: {
        memberId: memberId,
        guildId: guildId,
      },
    });

    if (SHOULD_USER_LEVEL_UP) {
      for (const item of LIST) {
        if (memberMessages >= item.count) {
          const role = message.guild?.roles.cache.find(
            (role) => role.name === item.role
          );

          if (role && !message.member?.roles.cache.has(role?.id)) {
            await message.member?.roles.add(role);

            await message.channel.send(
              `@${message.member?.displayName}, you just advanced to ${role.name}! 🎉🎉🎉`
            );
          }
        }
      }
    }
  }
}
