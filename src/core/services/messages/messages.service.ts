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

    // case-insensitive jail check
    const memberInJail = message.member?.roles.cache.some(
      (role) =>
        JAIL.toLowerCase() === role.name.toLowerCase() ||
        VOICE_ONLY.toLowerCase() === role.name.toLowerCase(),
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

  // Hosts where the first path segment is the invite code (discord.gg/CODE).
  static readonly INVITE_CODE_HOSTS = new Set([
    "discord.gg",
    "dsc.gg",
    "invite.gg",
    "discord.io",
    "discord.li",
    "discord.me",
    "discord.st",
    "dis.gd",
  ]);

  // Hosts where the code sits under /invite/CODE.
  static readonly INVITE_PATH_HOSTS = new Set([
    "discord.com",
    "discordapp.com",
    "ptb.discord.com",
    "canary.discord.com",
  ]);

  static readonly INVITE_HOST_PATTERN =
    /discord\.gg|dsc\.gg|invite\.gg|discord\.(?:io|li|me|st)|dis\.gd|(?:ptb\.|canary\.)?discord(?:app)?\.com/i;

  // Decode each maximal run of %XX bytes on its own. A single malformed escape
  // (e.g. "%.") makes decodeURIComponent throw for the whole string, which would
  // leave a percent-encoded invite hidden; Discord decodes what it can.
  static decodePercentRuns(input: string) {
    return input.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }

  // Resolve one URL-ish candidate with the WHATWG parser - the same resolution the
  // client performs via new URL() - so ports, userinfo, empty and dot segments all
  // collapse exactly as they do for the link the user actually clicks.
  static collectInviteCodes(candidate: string, sink: Set<string>) {
    const withScheme = /^https?:\/\//i.test(candidate)
      ? candidate
      : "https://" + candidate.replace(/^\/+/, "");
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return;
    }
    const host = url.hostname.toLowerCase();
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {}
    const segments = path.split("/").filter(Boolean);
    if (MessagesService.INVITE_CODE_HOSTS.has(host)) {
      if (segments[0]) sink.add(segments[0].toLowerCase());
    } else if (MessagesService.INVITE_PATH_HOSTS.has(host)) {
      if (segments[0]?.toLowerCase() === "invite" && segments[1])
        sink.add(segments[1].toLowerCase());
    }
  }

  // Extract invite codes with the same resolution the Discord client applies.
  // Tricks that live above the URL grammar are undone first (invisible chars,
  // angle-bracket wrapping, defanged and unicode/full-width dots, backslashes,
  // percent-encoding); the URL itself is then resolved by new URL(). Candidates are
  // taken both per whitespace-delimited token (how a bare link is linkified) and
  // from the whole message reflowed onto one line (how a blockquote-split URL is
  // rejoined), so either shape resolves.
  static extractInviteCodes(raw: string) {
    let content = raw
      .replace(
        /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff\u180e]/g,
        "",
      )
      .replace(/[<>]/g, "")
      .replace(/[[(){}]\.[\])}]/g, ".")
      .replace(/[\u3002\uff0e\uff61\u2024]/g, ".")
      .replace(/\\/g, "/");
    for (let i = 0; i < 3; i++) {
      const decoded = MessagesService.decodePercentRuns(content);
      if (decoded === content) break;
      content = decoded;
    }

    const codes = new Set<string>();
    for (const token of content.split(/\s+/))
      if (token && MessagesService.INVITE_HOST_PATTERN.test(token))
        MessagesService.collectInviteCodes(token, codes);

    const reflowed = content.replace(/^\s*>+/gm, "").replace(/\s+/g, "");
    if (MessagesService.INVITE_HOST_PATTERN.test(reflowed)) {
      const slices = reflowed.match(
        new RegExp(
          "(?:https?:\\/\\/|\\/\\/)?[a-z0-9.@:%-]*(?:" +
            MessagesService.INVITE_HOST_PATTERN.source +
            ")[^\\s]*",
          "gi",
        ),
      );
      if (slices)
        for (const slice of slices)
          MessagesService.collectInviteCodes(slice, codes);
    }
    return [...codes];
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
