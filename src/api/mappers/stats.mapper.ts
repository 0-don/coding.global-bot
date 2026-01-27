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
