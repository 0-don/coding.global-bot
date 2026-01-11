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

      await prisma.$transaction(async (tx) => {
        // Delete existing roles to avoid duplicates
        await tx.memberRole.deleteMany({
          where: { memberId: member.id, guildId: member.guild.id },
        });

        // Upsert member (global user data)
        await tx.member.upsert({
          where: { memberId: memberData.memberId },
          create: memberData,
          update: memberData,
        });

        // Upsert member guild (guild-specific data)
        await tx.memberGuild.upsert({
          where: {
            member_guild: {
              memberId: memberGuildData.memberId,
              guildId: memberGuildData.guildId,
            },
          },
          create: memberGuildData,
          update: memberGuildData,
        });

        // Create member roles if any exist
        if (memberRoleCreates.length > 0) {
          await tx.memberRole.createMany({
            data: memberRoleCreates,
            skipDuplicates: true,
          });
        }
      });
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
