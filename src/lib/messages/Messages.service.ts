import {
  AuditLogEvent,
  Message,
  MessageType,
  PartialMessage,
  TextChannel,
} from "discord.js";
import { prisma } from "../../prisma.js";
import {
  JAIL,
  LEVEL_LIST,
  LEVEL_MESSAGES,
  SHOULD_USER_LEVEL_UP,
  VERIFY_CHANNELS,
} from "../constants.js";

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
    if (!SHOULD_USER_LEVEL_UP || message.author.bot) return;

    const memberInJail = message.member?.roles.cache.some(
      (role) => JAIL === role.name
    );

    if (memberInJail) return;

    const memberMessages = await prisma.memberMessages.count({
      where: { memberId: message.member?.id, guildId: message.guild?.id },
    });

    for (const item of LEVEL_LIST) {
      if (memberMessages >= item.count) {
        const role = message.guild?.roles.cache.find(
          (role) => role.name === item.role
        );

        if (
          role &&
          !message.member?.roles.cache.has(role?.id) &&
          role.editable
        ) {
          await message.member?.roles.add(role);

          const messages =
            LEVEL_MESSAGES[
              role.name.toUpperCase() as keyof typeof LEVEL_MESSAGES
            ];
          const randomMessage = messages[
            Math.floor(Math.random() * messages.length)
          ]
            .replace("${user}", message.member?.toString() ?? "")
            .replace("${role}", role.toString());

          await (message.channel as TextChannel).send({
            content: randomMessage,
            allowedMentions: { users: [] },
          });
        }
      }
    }
  }
}
