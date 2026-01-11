import { Guild, Message } from "discord.js";
import { prisma } from "@/prisma";
import {
  mapMemberGuild,
  mapAttachment,
  mapEmbed,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";

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
