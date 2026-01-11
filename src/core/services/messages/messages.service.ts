import {
  AuditLogEvent,
  Collection,
  FetchMessagesOptions,
  Message,
  PartialMessage,
  PrivateThreadChannel,
  PublicThreadChannel,
  TextBasedChannel,
  TextChannel,
} from "discord.js";
import { prisma } from "@/prisma";
import { ConfigValidator } from "@/shared/config/validator";
import { JAIL, VOICE_ONLY } from "@/shared/config/roles";
import { LEVEL_LIST, LEVEL_MESSAGES } from "@/shared/config/levels";
import { deleteUserMessages } from "@/core/services/messages/delete-user-messages";

export class MessagesService {
  private static _levelSystemWarningLogged = false;

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

  // static async cleanUpVerifyChannel(message: Message<boolean>) {
  //   const channel = (await message.channel?.fetch()) as TextChannel;
  //   // remove non command messages in verify channel
  //   if (
  //     VERIFY_CHANNELS.includes(channel.name) &&
  //     message.type !== MessageType.ChatInputCommand
  //   ) {
  //     message.delete();
  //   }
  // }

  static async saveDeletedMessageHistory(
    message: Message<boolean> | PartialMessage,
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
    if (message.author.bot) return;

    if (!ConfigValidator.isFeatureEnabled("SHOULD_USER_LEVEL_UP")) {
      if (!this._levelSystemWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Level Up System",
          "SHOULD_USER_LEVEL_UP",
        );
        this._levelSystemWarningLogged = true;
      }
      return;
    }

    if (!ConfigValidator.isFeatureEnabled("LEVEL_ROLES")) {
      if (!this._levelSystemWarningLogged) {
        ConfigValidator.logFeatureDisabled("Level Up System", "LEVEL_ROLES");
        this._levelSystemWarningLogged = true;
      }
      return;
    }

    const memberInJail = message.member?.roles.cache.some(
      (role) =>
        JAIL === role.name.toLowerCase() ||
        VOICE_ONLY === role.name.toLowerCase(),
    );

    if (memberInJail) return;

    const memberMessages = await prisma.memberMessages.count({
      where: { memberId: message.member?.id, guildId: message.guild?.id },
    });

    for (const item of LEVEL_LIST) {
      if (memberMessages >= item.count) {
        const role = message.guild?.roles.cache.find(
          (role) => role.name === item.role,
        );

        if (
          role &&
          !message.member?.roles.cache.has(role?.id) &&
          role.editable
        ) {
          await message.member?.roles.add(role);

          const messages =
            LEVEL_MESSAGES[role.name as keyof typeof LEVEL_MESSAGES];
          const randomMessage = messages[
            Math.floor(Math.random() * messages.length)
          ]
            .replace(/\${user}/g, message.member?.toString() ?? "")
            .replace(/\${role}/g, role.toString());

          await (message.channel as TextChannel).send({
            content: randomMessage,
            allowedMentions: { users: [], roles: [] },
          });
        }
      }
    }
  }

  // Fetch messages utility
  static async fetchMessages(
    channel:
      | TextBasedChannel
      | TextChannel
      | PrivateThreadChannel
      | PublicThreadChannel<boolean>,
    limit: number = 100,
  ): Promise<Message[]> {
    let out: Message[] = [];
    if (limit <= 100) {
      let messages: Collection<string, Message> = await channel.messages.fetch({
        limit: limit,
      });
      const messagesArray = Array.from(messages.values(), (value) => value);
      out.push(...messagesArray);
    } else {
      const rounds = limit / 100 + (limit % 100 ? 1 : 0);
      let lastId: string = "";
      for (let x = 0; x < rounds; x++) {
        const options: FetchMessagesOptions = {
          limit: 100,
        };

        if (lastId.length > 0) options.before = lastId;

        const messages: Collection<string, Message> =
          await channel.messages.fetch(options);

        const messagesArray = Array.from(messages.values(), (value) => value);
        out.push(...messagesArray);

        lastId = messagesArray[messagesArray.length - 1]?.id || "";
      }
    }
    // remove duplicates
    return out.filter(
      (message, index, self) =>
        self.findIndex((m) => m.id === message.id) === index,
    );
  }

  // Check warnings utility
  static async checkWarnings(message: Message<boolean>) {
    const content = message.content;
    const member = message.member;

    if (!member || !message.guild) return;

    const memberGuild = await prisma.memberGuild.findFirst({
      where: { memberId: member.id },
    });

    if (!memberGuild) return;

    if (
      content.includes("discord.gg/") ||
      content.includes("discordapp.com/invite") ||
      content.includes("discord.com/invite")
    ) {
      await message.delete();

      const currentWarnings = memberGuild.warnings + 1;

      await prisma.memberGuild.update({
        where: { id: memberGuild.id },
        data: { warnings: currentWarnings },
      });

      if (currentWarnings < 4) {
        try {
          await member.send(
            `Stop posting invites, you have been warned. Warnings: ${currentWarnings}, you will be muted at 3 warnings.`,
          );
        } catch (error) {}
      } else {
        await deleteUserMessages({
          jail: true,
          memberId: member.id,
          user: member.user,
          guild: message.guild,
          reason: `Posted Discord invite links (${currentWarnings} warnings)`,
        });

        try {
          await member.send(`You have been muted asks a mod to unmute you.`);
        } catch (error) {}
      }
    }
  }
}
