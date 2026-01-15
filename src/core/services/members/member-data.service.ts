import type { GuildMember } from "discord.js";
import { prisma } from "@/prisma";
import {
  prepareMemberData,
  prepareMemberGuildData,
  prepareMemberRolesData,
} from "@/shared/mappers/member-to-db.mapper";

export class MemberDataService {
  static async updateCompleteMemberData(member: GuildMember) {
    try {
      const user = await member.user.fetch(true);
      const guildMember = await member.fetch(true);

      const memberData = prepareMemberData(user);
      const memberGuildData = prepareMemberGuildData(guildMember);
      const memberRoleCreates = prepareMemberRolesData(guildMember);

      // Upsert member first (required for foreign key constraints)
      await prisma.member.upsert({
        where: { memberId: memberData.memberId },
        create: memberData,
        update: memberData,
      });

      // Run memberGuild upsert and role sync in parallel
      await Promise.all([
        prisma.memberGuild.upsert({
          where: {
            member_guild: {
              memberId: memberGuildData.memberId,
              guildId: memberGuildData.guildId,
            },
          },
          create: memberGuildData,
          update: memberGuildData,
        }),
        // Delete and recreate roles
        (async () => {
          await prisma.memberRole.deleteMany({
            where: { memberId: member.id, guildId: member.guild.id },
          });
          if (memberRoleCreates.length > 0) {
            await prisma.memberRole.createMany({
              data: memberRoleCreates,
              skipDuplicates: true,
            });
          }
        })(),
      ]);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Connect Timeout Error")
      ) {
        return;
      }
      console.error(
        `Failed to update complete member data for ${member.id} ${member.user.username}:`,
        error,
      );
    }
  }
}
