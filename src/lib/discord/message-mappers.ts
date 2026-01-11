import type {
  Attachment,
  Embed,
  MessageMentions,
  MessageReaction,
  MessageReference,
} from "discord.js";
import type { Prisma } from "../../generated/prisma/client";

export type MemberGuildWithRelations = Prisma.MemberGuildGetPayload<{
  include: {
    member: {
      include: {
        roles: true;
      };
    };
  };
}>;

export const mapMemberGuild = (memberGuild: MemberGuildWithRelations, guildId: string) => {
  const roles = memberGuild.member.roles
    .filter((role) => role.roleId !== guildId)
    .map((role) => ({ name: role.name ?? "", position: role.position ?? 0 }));

  return {
    id: memberGuild.memberId,
    username: memberGuild.member.username,
    globalName: memberGuild.member.globalName,
    nickname: memberGuild.nickname,
    displayName: memberGuild.displayName,
    avatarUrl:
      memberGuild.avatarUrl ??
      memberGuild.member.avatarUrl ??
      `https://cdn.discordapp.com/embed/avatars/${parseInt(memberGuild.memberId) % 5}.png`,
    bannerUrl: memberGuild.bannerUrl ?? memberGuild.member.bannerUrl ?? null,
    accentColor: memberGuild.member.accentColor,
    displayHexColor: memberGuild.displayHexColor ?? "#000000",
    flags: memberGuild.member.flags?.toString() ?? null,
    collectibles: JSON.stringify(memberGuild.member.collectibles) ?? null,
    primaryGuild: JSON.stringify(memberGuild.member.primaryGuild) ?? null,
    roles,
    highestRolePosition: memberGuild.highestRolePosition ?? 0,
    status: memberGuild.presenceStatus ?? "offline",
    activity: memberGuild.presenceActivity ?? null,
    presenceUpdatedAt: memberGuild.presenceUpdatedAt?.toISOString() ?? null,
    premiumSince: memberGuild.premiumSince?.toISOString() ?? null,
    communicationDisabledUntil: memberGuild.communicationDisabledUntil?.toISOString() ?? null,
    joinedAt: memberGuild.joinedAt?.toISOString() ?? null,
    createdAt: memberGuild.member.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: memberGuild.member.updatedAt?.toISOString() ?? null,
  };
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
