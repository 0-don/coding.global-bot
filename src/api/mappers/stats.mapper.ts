import { StatsService } from "@/core/services/stats/stats.service";
import { prisma } from "@/prisma";
import { getMembers } from "./member.mapper";

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
  const resolvedUsers = await getMembers(allUserIds, guildId, { activeOnly: true });
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

export async function getUserStatsForApi(memberIds: string[], guildId: string) {
  // Batch check which users are in the server
  const memberGuilds = await prisma.memberGuild.findMany({
    where: {
      guildId,
      memberId: { in: memberIds },
      status: true,
    },
    select: { memberId: true },
  });

  const activeMemberIds = new Set(memberGuilds.map((mg) => mg.memberId));

  // Get stats for all active members
  const results = await Promise.all(
    memberIds
      .filter((id) => activeMemberIds.has(id))
      .map((memberId) => StatsService.getUserStats(memberId, guildId)),
  );

  return results.filter((stats) => stats !== null);
}
