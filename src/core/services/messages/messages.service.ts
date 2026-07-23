import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { PrivacyService } from "@/core/services/privacy/privacy.service";
import { db } from "@/lib/db";
import { memberMessages, memberDeletedMessages, memberGuild } from "@/lib/db-schema";
import { and, count, eq } from "drizzle-orm";
import { LEVEL_LIST, LEVEL_MESSAGES } from "@/shared/config/levels";
import { JAIL, VOICE_ONLY } from "@/shared/config/roles";
import { ConfigValidator } from "@/shared/config/validator";
import {
  AuditLogEvent,
  Collection,
  FetchMessagesOptions,
  GuildTextBasedChannel,
  Message,
  PartialMessage,
  RESTJSONErrorCodes,
  TextChannel,
} from "discord.js";

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

    if (await PrivacyService.hasMessageOptOut(memberId, guildId)) return;

    // catch message edits
    try {
      await db.insert(memberMessages)
        .values({ id: messageId, channelId, guildId, memberId, messageId })
        .onConflictDoUpdate({
          target: memberMessages.messageId,
          set: { channelId, guildId, memberId },
        });
    } catch (_) {}
  }

  static async deleteMessageDb(message: Message<boolean> | PartialMessage) {
    const messageId = message.id;

    if (!messageId) return;

    try {
      await db.delete(memberMessages)
        .where(eq(memberMessages.messageId, messageId));
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

    if (await PrivacyService.hasMessageOptOut(messageMemberId, guildId)) return;

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

      await db.insert(memberDeletedMessages).values({
        content,
        deletedByMemberId,
        messageMemberId,
        channelId,
        messageId,
        guildId,
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

    const [result] = await db
      .select({ count: count() })
      .from(memberMessages)
      .where(
        and(
          eq(memberMessages.memberId, message.member?.id ?? ""),
          eq(memberMessages.guildId, message.guild?.id ?? ""),
        )
      );

    const memberMessagesCount = result?.count ?? 0;

    for (const item of LEVEL_LIST) {
      if (memberMessagesCount >= item.count) {
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
    channel: GuildTextBasedChannel,
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

  // RFC-style path normalization: a ".." segment pops the previous path segment
  // and "."/empty segments are dropped, but ".." can never pop above the path root
  // (it cannot remove the host), matching how a browser resolves the URL.
  static normalizeUrlPath(path: string) {
    const out: string[] = [];
    for (const segment of path.split("/")) {
      if (segment === "..") out.pop();
      else if (segment === "." || segment === "") continue;
      else out.push(segment);
    }
    return "/" + out.join("/");
  }

  // General invite parser: canonicalize the URL the way Discord's client would, then
  // extract codes. Undoes invisible/zero-width chars, angle-bracket wrapping,
  // blockquote (">") + newline splitting, whitespace/punctuation stuffing, defanged
  // and unicode/full-width dots, backslashes, (double) percent-encoding, scheme +
  // userinfo (evil@discord.gg) + port noise, and per-host path traversal. Matches
  // discord.gg, discord(app).com/invite (+ ptb/canary), and third-party shorteners
  // (dsc.gg, invite.gg, discord.io/li/me/st, dis.gd).
  static extractInviteCodes(raw: string) {
    let content = raw
      .replace(
        /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff\u180e]/g,
        "",
      )
      .replace(/[<>]/g, "")
      .replace(/^\s*>+/gm, "")
      .replace(/[[(){}]\.[\])}]/g, ".")
      .replace(/[\u3002\uff0e\uff61\u2024]/g, ".")
      .replace(/\\/g, "/")
      .replace(/\s+/g, "");
    for (let i = 0; i < 3; i++) {
      // Decode each maximal run of %XX bytes on its own. A single malformed
      // escape (e.g. "%.") would make decodeURIComponent throw for the whole
      // string; Discord decodes valid sequences and leaves bad ones literal.
      const decoded = content.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
        try {
          return decodeURIComponent(run);
        } catch {
          return run;
        }
      });
      if (decoded === content) break;
      content = decoded;
    }
    content = content
      .toLowerCase()
      .replace(/https?:/g, "")
      .replace(/(^|\/\/|\/)[^/\s]*@/g, "$1")
      .replace(/:\d+(?=\/)/g, "");
    const hostRegex =
      /(discord\.gg|(?:ptb\.|canary\.)?discord(?:app)?\.com|dsc\.gg|invite\.gg|discord\.(?:io|li|me|st)|dis\.gd)(\/[^\s]*)?/gi;
    const inviteRegex =
      /^(?:discord\.gg|(?:ptb\.|canary\.)?discord(?:app)?\.com\/invite|dsc\.gg|invite\.gg|discord\.(?:io|li|me|st)|dis\.gd)\/([a-z0-9-]+)/i;
    const codes: string[] = [];
    for (const match of content.matchAll(hostRegex)) {
      const host = match[1];
      const path = match[2] ? MessagesService.normalizeUrlPath(match[2]) : "";
      const invite = (host + path).match(inviteRegex);
      if (invite) codes.push(invite[1]);
    }
    return codes;
  }

  // Check warnings utility
  static async checkWarnings(message: Message<boolean>) {
    const member = message.member;

    if (!member || !message.guild) return;

    const inviteCodes = [
      ...new Set(MessagesService.extractInviteCodes(message.content)),
    ].slice(0, 5);

    if (inviteCodes.length === 0) return;

    const memberGuildData = await db.query.memberGuild.findFirst({
      where: and(
        eq(memberGuild.memberId, member.id),
        eq(memberGuild.guildId, message.guild.id),
      ),
    });

    if (!memberGuildData) return;

    let hasExternalInvite = false;

    for (const code of inviteCodes) {
      try {
        const invite = await message.client.fetchInvite(code);
        if (invite.guild?.id !== message.guild.id) {
          hasExternalInvite = true;
          break;
        }
      } catch (error) {
        // Unknown Invite: the code resolves to nothing, so it was an invite-shaped
        // link to a dead/fake server - treat as external. Transient failures
        // (rate limit, network) are our problem, not the user's, so skip them.
        if (
          error instanceof Object &&
          "code" in error &&
          error.code === RESTJSONErrorCodes.UnknownInvite
        ) {
          hasExternalInvite = true;
          break;
        }
      }
    }

    if (hasExternalInvite) {
      await message.delete();

      const currentWarnings = memberGuildData.warnings + 1;

      await db.update(memberGuild)
        .set({ warnings: currentWarnings })
        .where(eq(memberGuild.id, memberGuildData.id));

      if (currentWarnings < 4) {
        try {
          await member.send(
            `Stop posting invites, you have been warned. Warnings: ${currentWarnings}, you will be muted at 3 warnings.`,
          );
        } catch (error) {}
      } else {
        await DeleteUserMessagesService.jailAndDeleteMessages({
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
