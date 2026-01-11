import { Guild, Message } from "discord.js";
import { t } from "elysia";
import {
  mapAttachment,
  mapEmbed,
  mapMemberGuild,
  mapMentions,
  mapReactions,
  mapReference,
  type DbAttachment,
  type DbEmbed,
  type DbMentions,
  type DbReaction,
  type DbReference,
} from "../lib/discord/message-mappers";
import { MembersService } from "../lib/members/members.service";
import { StatsService } from "../lib/stats/stats.service";
import { ThreadService } from "../lib/threads/thread.service";
import { prisma } from "../prisma";

export const PAGE_LIMIT = 100;
export const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const BoardType = t.Union([
  // Marketplace & Showcase
  t.Literal("job-board"),
  t.Literal("dev-board"),
  t.Literal("showcase"),
  // Programming language channels
  t.Literal("cpp"),
  t.Literal("csharp"),
  t.Literal("c"),
  t.Literal("dart"),
  t.Literal("lua"),
  t.Literal("go"),
  t.Literal("html-css"),
  t.Literal("java"),
  t.Literal("javascript"),
  t.Literal("kotlin"),
  t.Literal("python"),
  t.Literal("rust"),
  t.Literal("php"),
  t.Literal("bash-powershell"),
  t.Literal("sql"),
  t.Literal("swift"),
  t.Literal("visual-basic"),
  t.Literal("zig"),
  t.Literal("other"),
]);

type DbThread = Awaited<ReturnType<typeof ThreadService.getThread>>;
type DbThreadList = Awaited<ReturnType<typeof ThreadService.getThreadsByBoard>>;
type DbReplies = Awaited<ReturnType<typeof ThreadService.getReplies>>;

export const ThreadParams = t.Object({
  guildId: t.String(),
  boardType: BoardType,
  threadId: t.String(),
});

export async function parseMultipleUsersWithRoles(
  userIds: string[],
  guildId: string | Guild,
) {
  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const members = await prisma.memberGuild.findMany({
    where: {
      memberId: { in: userIds },
      guildId: resolvedGuildId,
      status: true,
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId: resolvedGuildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
  });

  const formattedMembers = members.map((memberGuild) =>
    mapMemberGuild(memberGuild, resolvedGuildId),
  );

  return formattedMembers.sort(
    (a, b) => b.highestRolePosition - a.highestRolePosition,
  );
}

export function parseMessage(message: Message) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    pinned: message.pinned,
    tts: message.tts,
    type: message.type.toString(),
    attachments: Array.from(message.attachments.values()).map(mapAttachment),
    embeds: message.embeds.map(mapEmbed),
    mentions: mapMentions(message.mentions),
    reactions: mapReactions(message.reactions.cache.values()),
    reference: mapReference(message.reference),
  };
}

export async function getTopStatsWithUsers(
  guildId: string,
  days: number,
  limit: number,
) {
  const stats = await StatsService.getTopStats(guildId, days, limit);

  // Collect all unique user IDs to resolve
  const allUserIds = [
    ...new Set([
      ...stats.mostActiveMessageUsers.map((u) => u.memberId),
      ...stats.mostHelpfulUsers.map((u) => u.memberId),
      ...stats.mostActiveVoiceUsers.map((u) => u.memberId),
    ]),
  ];

  // Resolve users with Discord data (avatars, display names)
  const resolvedUsers = await parseMultipleUsersWithRoles(allUserIds, guildId);
  const userMap = new Map(resolvedUsers.map((u) => [u.id, u]));

  return {
    ...stats,
    mostActiveMessageUsers: stats.mostActiveMessageUsers
      .filter((user) => userMap.has(user.memberId))
      .map((user) => ({
        ...userMap.get(user.memberId),
        count: user.count,
      })),
    mostHelpfulUsers: stats.mostHelpfulUsers
      .filter((user) => userMap.has(user.memberId))
      .map((user) => ({
        ...userMap.get(user.memberId),
        count: user.count,
      })),
    mostActiveVoiceUsers: stats.mostActiveVoiceUsers
      .filter((user) => userMap.has(user.memberId))
      .map((user) => ({
        ...userMap.get(user.memberId),
        sum: user.sum,
      })),
  };
}

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
    attachments: (reply.attachments || []) as DbAttachment[],
    embeds: (reply.embeds || []) as DbEmbed[],
    mentions: (reply.mentions || {
      users: [],
      roles: [],
      everyone: false,
    }) as DbMentions,
    reactions: (reply.reactions || []) as DbReaction[],
    reference: (reply.reference || null) as DbReference,
    author: formatAuthorFromDb(reply.author, guildId),
  };
}

export function formatRepliesFromDb(
  replies: DbReplies["messages"],
  guildId: string,
) {
  return replies.map((reply) => formatReplyFromDb(reply, guildId));
}

export async function searchUsers(
  guildId: string,
  query: string,
  limit: number = 10,
) {
  const members = await prisma.memberGuild.findMany({
    where: {
      guildId,
      status: true,
      member: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { globalName: { contains: query, mode: "insensitive" } },
        ],
      },
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
    orderBy: { highestRolePosition: "desc" },
    take: Math.min(limit, 50),
  });

  return members.map((memberGuild) => mapMemberGuild(memberGuild, guildId));
}

export async function getUserStatsForApi(memberId: string, guildId: string) {
  // Check if user is in the server
  const memberGuild = await prisma.memberGuild.findUnique({
    where: {
      member_guild: { memberId, guildId },
    },
  });

  if (!memberGuild || !memberGuild.status) {
    return null;
  }

  return StatsService.getUserStats(memberId, guildId);
}

export { MembersService };
