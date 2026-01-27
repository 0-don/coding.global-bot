import { prisma } from "@/prisma";
import {
  mapAttachment,
  mapEmbed,
  mapMemberGuild,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";
import { Guild, Message } from "discord.js";

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

/**
 * Resolve user IDs to minimal user data for mention display.
 * Returns an array of { id, username, globalName }
 */
export async function resolveMentionedUsers(userIds: string[]) {
  if (userIds.length === 0) return [];

  const members = await prisma.member.findMany({
    where: { memberId: { in: userIds } },
    select: {
      memberId: true,
      username: true,
      globalName: true,
    },
  });

  return members.map((m) => ({
    id: m.memberId,
    username: m.username,
    globalName: m.globalName,
  }));
}
