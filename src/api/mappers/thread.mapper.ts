import { ThreadService } from "@/core/services/threads/thread.service";
import {
  mapAttachmentsFromDb,
  mapEmbedsFromDb,
  mapMentionsFromDb,
  mapReactionsFromDb,
  mapReferenceFromDb,
} from "@/shared/mappers/discord.mapper";

type DbThread = Awaited<ReturnType<typeof ThreadService.getThread>>;
type DbThreadList = Awaited<ReturnType<typeof ThreadService.getThreadsByBoard>>;
type DbReplies = Awaited<ReturnType<typeof ThreadService.getReplies>>;

function formatAuthorFromDb(
  author: NonNullable<DbThread>["author"],
  guildId: string,
) {
  const memberGuild = author.guilds.find((g) => g.guildId === guildId);
  const roles = author.roles
    .filter((r) => r.guildId === guildId)
    .map((r) => ({ name: r.name || "", position: r.position || 0 }))
    .sort((a, b) => b.position - a.position);

  return {
    id: author.memberId,
    username: author.username,
    globalName: author.globalName,
    nickname: memberGuild?.nickname || null,
    displayName:
      memberGuild?.displayName || author.globalName || author.username,
    avatarUrl:
      memberGuild?.avatarUrl ||
      author.avatarUrl ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(author.memberId) % 5}.png`,
    bannerUrl: memberGuild?.bannerUrl || author.bannerUrl,
    accentColor: author.accentColor,
    displayHexColor: memberGuild?.displayHexColor || "#000000",
    flags: author.flags ? author.flags.toString() : null,
    collectibles: author.collectibles
      ? JSON.stringify(author.collectibles)
      : null,
    primaryGuild: author.primaryGuild
      ? JSON.stringify(author.primaryGuild)
      : null,
    roles,
    highestRolePosition: memberGuild?.highestRolePosition || 0,
    status: memberGuild?.presenceStatus || "offline",
    activity: memberGuild?.presenceActivity || null,
    presenceUpdatedAt: memberGuild?.presenceUpdatedAt?.toISOString() || null,
    premiumSince: memberGuild?.premiumSince?.toISOString() || null,
    communicationDisabledUntil:
      memberGuild?.communicationDisabledUntil?.toISOString() || null,
    joinedAt: memberGuild?.joinedAt?.toISOString() || null,
    createdAt: author.createdAt?.toISOString() || null,
    updatedAt: author.updatedAt?.toISOString() || null,
  };
}

export function formatThreadFromDb(
  dbThread: NonNullable<DbThread>,
  guildId: string,
) {
  const author = formatAuthorFromDb(dbThread.author, guildId);
  return {
    id: dbThread.id,
    name: dbThread.name,
    parentId: dbThread.parentId,
    boardType: dbThread.boardType,
    author,
    createdAt: dbThread.createdAt?.toISOString() || null,
    tags: dbThread.tags.map((tt) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      emoji: {
        id: tt.tag.emojiId || null,
        name: tt.tag.emojiName || null,
      },
    })),
    content: dbThread.content,
    imageUrl: dbThread.imageUrl,
    messageCount: dbThread.messageCount,
    totalMessageSent: dbThread.messageCount,
    memberCount: dbThread.memberCount,
    locked: dbThread.locked,
    archived: dbThread.archived,
    archivedAt: dbThread.archivedAt?.toISOString() || null,
    autoArchiveDuration: dbThread.autoArchiveDuration?.toString() || null,
    invitable: dbThread.invitable,
    rateLimitPerUser: dbThread.rateLimitPerUser,
    flags: dbThread.flags?.toString() ?? null,
  };
}

export function formatThreadsFromDb(threads: DbThreadList, guildId: string) {
  return threads.map((thread) => formatThreadFromDb(thread, guildId));
}

export function formatReplyFromDb(
  reply: DbReplies["messages"][number],
  guildId: string,
) {
  return {
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    editedAt: reply.editedAt?.toISOString() || null,
    pinned: reply.pinned,
    tts: reply.tts,
    type: reply.type,
    attachments: mapAttachmentsFromDb(reply.attachments),
    embeds: mapEmbedsFromDb(reply.embeds),
    mentions: mapMentionsFromDb(reply.mentions),
    reactions: mapReactionsFromDb(reply.reactions),
    reference: mapReferenceFromDb(reply.reference),
    author: formatAuthorFromDb(reply.author, guildId),
  };
}

export function formatRepliesFromDb(
  replies: DbReplies["messages"],
  guildId: string,
) {
  return replies.map((reply) => formatReplyFromDb(reply, guildId));
}
