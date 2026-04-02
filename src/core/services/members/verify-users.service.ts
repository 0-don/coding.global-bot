import { MemberDataService } from "@/core/services/members/member-data.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { db } from "@/lib/db";
import { guild, memberGuild, memberRole, syncProgress } from "@/lib/db-schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { JAIL, STATUS_ROLES, VERIFIED, VOICE_ONLY } from "@/shared/config/roles";
import { logTs } from "@/shared/utils/date.utils";
import {
  Collection,
  Guild,
  GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

export class VerifyAllUsersService {
  private static runningGuilds = new Set<string>();

  static isVerificationRunning(guildId: string): boolean {
    return this.runningGuilds.has(guildId);
  }

  static async verifyAllUsers(
    discordGuild: Guild,
    channel: GuildTextBasedChannel,
  ): Promise<Collection<string, GuildMember> | undefined> {
    const guildName = discordGuild.name.slice(0, 20);

    if (this.runningGuilds.has(discordGuild.id)) {
      await channel.send("Verification already running.");
      return;
    }

    this.runningGuilds.add(discordGuild.id);

    try {
      await db.insert(guild)
        .values({ guildId: discordGuild.id, guildName: discordGuild.name })
        .onConflictDoUpdate({
          target: guild.guildId,
          set: { guildName: discordGuild.name },
        });

      const statusRoles = RolesService.getGuildStatusRoles(discordGuild);
      if (STATUS_ROLES.some((r) => !statusRoles[r])) {
        const missing = STATUS_ROLES.filter((r) => !statusRoles[r]).join(", ");
        await channel.send(`Missing roles: ${missing}`);
        return;
      }

      logTs("info", guildName, "Fetching members...");
      const allMembers = await discordGuild.members.fetch();

      const members = Array.from(allMembers.values())
        .filter((m) => !m.user.bot)
        .sort((a, b) => a.id.localeCompare(b.id));

      // Load saved progress - track by member ID, not index
      const saved = await db.query.syncProgress.findFirst({
        where: and(
          eq(syncProgress.guildId, discordGuild.id),
          eq(syncProgress.type, "users"),
        ),
      });
      const processedIds = new Set(saved?.processedIds ?? []);
      const failedIds = new Set(saved?.failedIds ?? []);

      // Only reset statuses when starting fresh (no saved progress)
      if (!saved) {
        await db.update(memberGuild)
          .set({ status: false })
          .where(eq(memberGuild.guildId, discordGuild.id));
      }

      // Filter out already processed members
      const remaining = members.filter((m) => !processedIds.has(m.id));
      const total = members.length;
      const alreadyDone = processedIds.size;

      const resumeMsg =
        alreadyDone > 0 ? ` (resuming: ${alreadyDone}/${total} done)` : "";
      logTs(
        "info",
        guildName,
        `Processing ${remaining.length} members${resumeMsg}`,
      );
      const progressMsg = await channel.send(
        `Processing ${total} members${resumeMsg}...`,
      );

      for (let i = 0; i < remaining.length; i++) {
        const discordMember = remaining[i];
        const tag = `${discordMember.user.username} (${discordMember.id})`;

        try {
          // Check if member has jail or voiceonly role in DB
          const jailRoleId = statusRoles[JAIL]?.id;
          const voiceOnlyRoleId = statusRoles[VOICE_ONLY]?.id;
          const restrictedRoleIds = [jailRoleId, voiceOnlyRoleId].filter(Boolean) as string[];

          const restrictedRole = restrictedRoleIds.length > 0
            ? await db.query.memberRole.findFirst({
                where: and(
                  eq(memberRole.memberId, discordMember.id),
                  eq(memberRole.guildId, discordGuild.id),
                  inArray(memberRole.roleId, restrictedRoleIds),
                ),
              })
            : null;

          if (restrictedRole) {
            const keepRoleId = restrictedRole.roleId;

            // Remove ALL other roles from Discord, keep only the restricted role
            const rolesToRemove = discordMember.roles.cache
              .filter((r) => r.id !== discordGuild.id && r.id !== keepRoleId && r.editable)
              .map((r) => r.id);
            for (const roleId of rolesToRemove) {
              await discordMember.roles.remove(roleId);
            }
            if (!discordMember.roles.cache.has(keepRoleId)) {
              const role = discordGuild.roles.cache.get(keepRoleId);
              if (role?.editable) await discordMember.roles.add(keepRoleId);
            }

            // Clean DB roles: delete all except the restricted role
            await db.delete(memberRole)
              .where(
                and(
                  eq(memberRole.memberId, discordMember.id),
                  eq(memberRole.guildId, discordGuild.id),
                  ne(memberRole.roleId, keepRoleId),
                ),
              );
          } else {
            // Not restricted: remove other status roles, add verified, then regular sync
            for (const statusName of STATUS_ROLES) {
              if (statusName === VERIFIED) continue;
              const role = statusRoles[statusName];
              if (role && discordMember.roles.cache.has(role.id) && role.editable) {
                await discordMember.roles.remove(role.id);
              }
            }
            if (statusRoles[VERIFIED]) {
              const verifiedId = statusRoles[VERIFIED]!.id;
              if (!discordMember.roles.cache.has(verifiedId)) {
                const role = discordGuild.roles.cache.get(verifiedId);
                if (role?.editable) await discordMember.roles.add(verifiedId);
              }
            }
            await MemberDataService.updateCompleteMemberData(discordMember);
          }
          processedIds.add(discordMember.id);
          logTs(
            "info",
            guildName,
            `✓ ${tag} (${alreadyDone + i + 1}/${total})`,
          );
        } catch {
          failedIds.add(discordMember.id);
          logTs(
            "error",
            guildName,
            `✗ ${tag} (${alreadyDone + i + 1}/${total})`,
          );
        }

        const done = alreadyDone + i + 1;

        await db.insert(syncProgress)
          .values({
            guildId: discordGuild.id,
            type: "users",
            processedIds: [...processedIds],
            failedIds: [...failedIds],
          })
          .onConflictDoUpdate({
            target: [syncProgress.guildId, syncProgress.type],
            set: {
              processedIds: [...processedIds],
              failedIds: [...failedIds],
            },
          });

        // Update Discord message
        if ((i + 1) % 25 === 0 || i + 1 === remaining.length) {
          const pct = Math.round((done / total) * 100);
          await progressMsg
            .edit(`Verifying: ${done}/${total} (${pct}%)`)
            .catch(() => {});
        }
      }

      // Clear progress on completion
      await db.delete(syncProgress)
        .where(
          and(
            eq(syncProgress.guildId, discordGuild.id),
            eq(syncProgress.type, "users"),
          )
        )
        .catch(() => {});

      const result =
        failedIds.size > 0
          ? `Done! Processed ${total} members (${failedIds.size} failed)`
          : `Done! Processed ${total} members`;
      await progressMsg.edit(result).catch(() => {});
      logTs("info", guildName, result);

      return allMembers;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTs("error", guildName, `Verification failed: ${msg}`);
      await channel.send(`Error: ${msg}. Run again to resume.`);
      throw err;
    } finally {
      this.runningGuilds.delete(discordGuild.id);
    }
  }
}
