import { prisma } from "@/prisma";

export class LookbackService {
  static async setMemberLookback(
    memberId: string,
    guildId: string,
    lookback: number,
  ): Promise<void> {
    await prisma.memberGuild.upsert({
      where: { member_guild: { guildId, memberId } },
      create: { guildId, lookback, memberId, status: true },
      update: { guildId, lookback, memberId, status: true },
    });
  }

  static async setGuildLookback(
    guildId: string,
    guildName: string,
    lookback: number,
  ): Promise<void> {
    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName, lookback },
      update: { guildName, lookback },
    });
  }
}
