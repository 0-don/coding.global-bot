import { PrismaClient } from '@prisma/client';
import { topStatsExampleEmbed } from '../constants';

const prisma = new PrismaClient();

export const topStatsEmbed = async () => {
  const mostActiveMessageUsers = await prisma.$queryRaw<
    [{ memberId: string; count: number }]
  >`SELECT "memberId", count(*) FROM "MemberMessages" GROUP BY "memberId" ORDER BY count(*) DESC LIMIT 5`;
  const mostActiveMessageUsersSum = mostActiveMessageUsers.reduce(
    (a, b) => a + Number(b.count),
    0
  );

  return topStatsExampleEmbed({
    mostActiveMessageUsers,
    mostActiveMessageUsersSum,
  });
};
