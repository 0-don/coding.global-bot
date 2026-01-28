import { db } from "@/lib/db";
import { memberGuild, member, memberRole } from "@/lib/db-schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  mapAttachment,
  mapEmbed,
  mapMemberGuild,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";
import { Guild, Message } from "discord.js";

export async function getMembers(
  userIds: string[],
  guildId: string | Guild,
  options?: { activeOnly?: boolean },
) {
  if (userIds.length === 0) return [];

  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const conditions = [
    inArray(memberGuild.memberId, userIds),
    eq(memberGuild.guildId, resolvedGuildId),
  ];
  if (options?.activeOnly) {
    conditions.push(eq(memberGuild.status, true));
  }

  const members = await db.query.memberGuild.findMany({
    where: and(...conditions),
    with: {
      member: {
        with: {
          memberRoles: true,
        },
      },
    },
  });

  // Filter and sort roles for guildId
  const membersWithFilteredRoles = members.map((mg) => ({
    ...mg,
    member: {
      ...mg.member,
      memberRoles: mg.member.memberRoles
        .filter((r) => r.guildId === resolvedGuildId)
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0)),
    },
  }));

  return membersWithFilteredRoles
    .map((mg) => mapMemberGuild(mg, resolvedGuildId))
    .sort((a, b) => b.highestRolePosition - a.highestRolePosition);
}

export async function searchUsers(
  guildId: string,
  query: string,
  limit: number = 10,
) {
  // Use raw SQL for case-insensitive search
  const searchPattern = `%${query}%`;

  const members = await db.query.memberGuild.findMany({
    where: and(
      eq(memberGuild.guildId, guildId),
      eq(memberGuild.status, true),
    ),
    with: {
      member: {
        with: {
          memberRoles: true,
        },
      },
    },
    orderBy: desc(memberGuild.highestRolePosition),
    limit: Math.min(limit, 50),
  });

  // Filter by username or globalName (case-insensitive)
  const filtered = members.filter((mg) => {
    const username = mg.member.username?.toLowerCase() ?? "";
    const globalName = mg.member.globalName?.toLowerCase() ?? "";
    const searchLower = query.toLowerCase();
    return username.includes(searchLower) || globalName.includes(searchLower);
  });

  // Filter and sort roles for guildId
  const membersWithFilteredRoles = filtered.map((mg) => ({
    ...mg,
    member: {
      ...mg.member,
      memberRoles: mg.member.memberRoles
        .filter((r) => r.guildId === guildId)
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0)),
    },
  }));

  return membersWithFilteredRoles.map((mg) => mapMemberGuild(mg, guildId));
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
