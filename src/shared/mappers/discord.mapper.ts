import type { Prisma } from "@/generated/prisma/client";
import type {
  Attachment,
  Embed,
  MessageMentions,
  MessageReaction,
  MessageReference,
} from "discord.js";

// Type for MemberGuild-first queries (e.g., member search)
export type MemberGuildWithRelations = Prisma.MemberGuildGetPayload<{
  include: {
    member: {
      include: {
        roles: true;
      };
    };
  };
}>;

// Type for Member-first queries (e.g., thread author)
export type MemberWithGuildsAndRoles = Prisma.MemberGetPayload<{
  include: {
    guilds: true;
    roles: true;
  };
}>;

type MemberGuild =
  | MemberGuildWithRelations
  | MemberWithGuildsAndRoles["guilds"][number]
  | null;
type Member = MemberGuildWithRelations["member"] | MemberWithGuildsAndRoles;
type MemberRole = { name: string | null; position: number | null };

// Core mapper - builds response from member + guild data
const buildMemberResponse = (
  member: Member,
  guild: MemberGuild,
  roles: MemberRole[],
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
  roles: roles.map((r) => ({ name: r.name ?? "", position: r.position ?? 0 })),
  highestRolePosition: guild?.highestRolePosition ?? 0,
  status: guild?.presenceStatus ?? "offline",
  activity: guild?.presenceActivity ?? null,
  presenceUpdatedAt: guild?.presenceUpdatedAt?.toISOString() ?? null,
  premiumSince: guild?.premiumSince?.toISOString() ?? null,
  communicationDisabledUntil:
    guild?.communicationDisabledUntil?.toISOString() ?? null,
  joinedAt: guild?.joinedAt?.toISOString() ?? null,
  createdAt: member.createdAt?.toISOString() ?? new Date().toISOString(),
  updatedAt: member.updatedAt?.toISOString() ?? null,
});

// MemberGuild-first queries (member search, stats)
export const mapMemberGuild = (
  data: MemberGuildWithRelations,
  guildId: string,
) =>
  buildMemberResponse(
    data.member,
    data,
    data.member.roles.filter((r) => r.roleId !== guildId),
  );

// Member-first queries (thread authors)
export const mapMember = (data: MemberWithGuildsAndRoles, guildId: string) => {
  const guild = data.guilds.find((g) => g.guildId === guildId);
  const roles = data.roles
    .filter((r) => r.guildId === guildId && r.roleId !== guildId)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
  return buildMemberResponse(data, guild ?? null, roles);
};

export const mapAttachment = (a: Attachment) => ({
  id: a.id,
  url: a.url,
  proxyURL: a.proxyURL,
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
export const mapAttachmentsFromDb = (raw: unknown): DbAttachment[] =>
  Array.isArray(raw) ? (raw as DbAttachment[]) : [];

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
