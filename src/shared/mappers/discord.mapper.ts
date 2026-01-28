import type { InferSelectModel } from "drizzle-orm";
import type { member, memberGuild, memberRole } from "@/lib/db-schema";
import type {
  Attachment,
  Embed,
  MessageMentions,
  MessageReaction,
  MessageReference,
} from "discord.js";
import { extractExpiresAt } from "../utils/date.utils";

// Base types from Drizzle schema
type MemberSelect = InferSelectModel<typeof member>;
type MemberGuildSelect = InferSelectModel<typeof memberGuild>;
type MemberRoleSelect = InferSelectModel<typeof memberRole>;

// Type for MemberGuild-first queries (e.g., member search)
export type MemberGuildWithRelations = MemberGuildSelect & {
  member: MemberSelect & {
    memberRoles: MemberRoleSelect[];
  };
};

// Type for Member-first queries (e.g., thread author)
export type MemberWithGuildsAndRoles = MemberSelect & {
  memberGuilds: MemberGuildSelect[];
  memberRoles: MemberRoleSelect[];
};

type MemberGuildType =
  | MemberGuildWithRelations
  | MemberWithGuildsAndRoles["memberGuilds"][number]
  | null;
type MemberType = MemberGuildWithRelations["member"] | MemberWithGuildsAndRoles;
type MemberRoleType = { name: string | null; position: number | null };

// Core mapper - builds response from member + guild data
const buildMemberResponse = (
  member: MemberType,
  guild: MemberGuildType,
  roles: MemberRoleType[],
) => ({
  id: member.memberId,
  username: member.username,
  globalName: member.globalName,
  nickname: guild?.nickname ?? null,
  displayName: guild?.displayName ?? member.globalName ?? member.username,
  avatarUrl:
    guild?.avatarUrl ??
    member.avatarUrl ??
    `https://cdn.discordapp.com/embed/avatars/${parseInt(member.memberId) % 5}.png`,
  bannerUrl: guild?.bannerUrl ?? member.bannerUrl ?? null,
  accentColor: member.accentColor,
  displayHexColor: guild?.displayHexColor ?? "#000000",
  flags: member.flags?.toString() ?? null,
  collectibles: member.collectibles
    ? JSON.stringify(member.collectibles)
    : null,
  primaryGuild: member.primaryGuild
    ? JSON.stringify(member.primaryGuild)
    : null,
  roles: roles.filter((r) => r.name).map((r) => ({ name: r.name!, position: r.position ?? 0 })),
  highestRolePosition: guild?.highestRolePosition ?? 0,
  status: guild?.presenceStatus ?? "offline",
  activity: guild?.presenceActivity ?? null,
  presenceUpdatedAt: guild?.presenceUpdatedAt ?? null,
  premiumSince: guild?.premiumSince ?? null,
  communicationDisabledUntil: guild?.communicationDisabledUntil ?? null,
  joinedAt: guild?.joinedAt ?? null,
  createdAt: member.createdAt ?? new Date().toISOString(),
  updatedAt: member.updatedAt ?? null,
});

// MemberGuild-first queries (member search, stats)
export const mapMemberGuild = (
  data: MemberGuildWithRelations,
  guildId: string,
) =>
  buildMemberResponse(
    data.member,
    data,
    data.member.memberRoles.filter((r) => r.roleId !== guildId),
  );

// Member-first queries (thread authors)
export const mapMember = (data: MemberWithGuildsAndRoles, guildId: string) => {
  const guild = data.memberGuilds.find((g) => g.guildId === guildId);
  const roles = data.memberRoles
    .filter((r) => r.guildId === guildId && r.roleId !== guildId)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
  return buildMemberResponse(data, guild ?? null, roles);
};

export const mapAttachment = (a: Attachment) => ({
  id: a.id,
  url: a.url,
  proxyUrl: a.proxyURL,
  name: a.name,
  description: a.description ?? null,
  contentType: a.contentType ?? null,
  size: a.size,
  width: a.width ?? null,
  height: a.height ?? null,
  ephemeral: a.ephemeral,
  duration: a.duration ?? null,
  waveform: a.waveform ?? null,
  flags: a.flags?.bitfield.toString() ?? null,
});

export const mapAttachmentToDb = (a: Attachment, messageId: string) => ({
  id: a.id,
  messageId,
  url: a.url,
  proxyUrl: a.proxyURL,
  name: a.name,
  description: a.description ?? null,
  contentType: a.contentType ?? null,
  size: a.size,
  width: a.width ?? null,
  height: a.height ?? null,
  ephemeral: a.ephemeral,
  duration: a.duration ?? null,
  waveform: a.waveform ?? null,
  flags: a.flags?.bitfield.toString() ?? null,
  expiresAt: extractExpiresAt(a.url),
});

export const mapEmbed = (e: Embed) => ({
  title: e.title ?? null,
  description: e.description ?? null,
  url: e.url ?? null,
  color: e.color ?? null,
  timestamp: e.timestamp ?? null,
  fields: e.fields.map((f) => ({
    name: f.name,
    value: f.value,
    inline: f.inline,
  })),
  author: e.author
    ? {
        name: e.author.name,
        url: e.author.url ?? null,
        iconURL: e.author.iconURL ?? null,
        proxyIconURL: e.author.proxyIconURL ?? null,
      }
    : null,
  thumbnail: e.thumbnail
    ? {
        url: e.thumbnail.url,
        proxyURL: e.thumbnail.proxyURL ?? null,
        width: e.thumbnail.width ?? null,
        height: e.thumbnail.height ?? null,
      }
    : null,
  image: e.image
    ? {
        url: e.image.url,
        proxyURL: e.image.proxyURL ?? null,
        width: e.image.width ?? null,
        height: e.image.height ?? null,
      }
    : null,
  video: e.video
    ? {
        url: e.video.url ?? null,
        proxyURL: e.video.proxyURL ?? null,
        width: e.video.width ?? null,
        height: e.video.height ?? null,
      }
    : null,
  footer: e.footer
    ? {
        text: e.footer.text,
        iconURL: e.footer.iconURL ?? null,
        proxyIconURL: e.footer.proxyIconURL ?? null,
      }
    : null,
  provider: e.provider
    ? { name: e.provider.name ?? null, url: e.provider.url ?? null }
    : null,
});

export const mapMentions = (m: MessageMentions) => ({
  users: m.users.map((u) => ({
    id: u.id,
    username: u.username,
    globalName: u.globalName,
  })),
  roles: m.roles.map((r) => ({ id: r.id, name: r.name })),
  everyone: m.everyone,
});

export const mapReactions = (reactions: Iterable<MessageReaction>) =>
  Array.from(reactions).map((r) => ({
    emoji: { id: r.emoji.id, name: r.emoji.name },
    count: r.count,
  }));

export const mapReference = (ref: MessageReference | null) =>
  ref
    ? {
        messageId: ref.messageId ?? null,
        channelId: ref.channelId,
        guildId: ref.guildId ?? null,
      }
    : null;

// Inferred types for database storage
export type DbAttachment = ReturnType<typeof mapAttachment>;
export type DbEmbed = ReturnType<typeof mapEmbed>;
export type DbMentions = ReturnType<typeof mapMentions>;
export type DbReaction = ReturnType<typeof mapReactions>[number];
export type DbReference = ReturnType<typeof mapReference>;

// Mappers for reading from database (ensures proper native JSON types)
export const mapEmbedsFromDb = (raw: unknown): DbEmbed[] =>
  Array.isArray(raw) ? (raw as DbEmbed[]) : [];

export const mapMentionsFromDb = (raw: unknown): DbMentions =>
  raw && typeof raw === "object"
    ? (raw as DbMentions)
    : { users: [], roles: [], everyone: false };

export const mapReactionsFromDb = (raw: unknown): DbReaction[] =>
  Array.isArray(raw) ? (raw as DbReaction[]) : [];

export const mapReferenceFromDb = (raw: unknown): DbReference =>
  raw && typeof raw === "object" ? (raw as DbReference) : null;

// Regex to find user mentions in content: <@123> or <@!123>
const USER_MENTION_REGEX = /<@!?(\d+)>/g;

/**
 * Extract all user IDs from message content and embeds.
 * Returns unique IDs that can be used for batch lookup.
 */
export const extractUserIdsFromContent = (
  content: string | null,
  embeds?: DbEmbed[],
): string[] => {
  const ids = new Set<string>();

  // Parse main content
  if (content) {
    for (const match of content.matchAll(USER_MENTION_REGEX)) {
      ids.add(match[1]);
    }
  }

  // Parse embed descriptions and field values
  if (embeds) {
    for (const embed of embeds) {
      if (embed.description) {
        for (const match of embed.description.matchAll(USER_MENTION_REGEX)) {
          ids.add(match[1]);
        }
      }
      for (const field of embed.fields ?? []) {
        for (const match of field.value.matchAll(USER_MENTION_REGEX)) {
          ids.add(match[1]);
        }
      }
    }
  }

  return Array.from(ids);
};
