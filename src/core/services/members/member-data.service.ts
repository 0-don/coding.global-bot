import type { GuildMember } from "discord.js";
import { db } from "@/lib/db";
import { member, memberGuild, memberRole } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";
import {
  prepareMemberData,
  prepareMemberGuildData,
  prepareMemberRolesData,
} from "@/shared/mappers/member-to-db.mapper";

export class MemberDataService {
  static async updateCompleteMemberData(discordMember: GuildMember) {
    try {
      const user = await discordMember.user.fetch(true);
      const guildMember = await discordMember.fetch(true);

      const memberData = prepareMemberData(user);
      const memberGuildData = prepareMemberGuildData(guildMember);
      const memberRoleCreates = prepareMemberRolesData(guildMember);

      // Upsert member first (required for foreign key constraints)
      await db.insert(member)
        .values(memberData)
        .onConflictDoUpdate({
          target: member.memberId,
          set: memberData,
        });

      // Run memberGuild upsert and role sync in parallel
      await Promise.all([
        db.insert(memberGuild)
          .values(memberGuildData)
          .onConflictDoUpdate({
            target: [memberGuild.memberId, memberGuild.guildId],
            set: memberGuildData,
          }),
        // Delete and recreate roles
        (async () => {
          await db.delete(memberRole)
            .where(
              and(
                eq(memberRole.memberId, discordMember.id),
                eq(memberRole.guildId, discordMember.guild.id),
              )
            );
          if (memberRoleCreates.length > 0) {
            await db.insert(memberRole)
              .values(memberRoleCreates)
              .onConflictDoNothing();
          }
        })(),
      ]);
    } catch (error) {
      // Silently ignore expected errors
      if (error instanceof Error) {
        // Connect timeout - transient network issue
        if (error.message.includes("Connect Timeout Error")) return;
        // Unknown Member (10007) - member left the guild
        if ("code" in error && error.code === 10007) return;
      }
      console.error(
        `Failed to update complete member data for ${discordMember.id} ${discordMember.user.username}:`,
        error,
      );
    }
  }
}
