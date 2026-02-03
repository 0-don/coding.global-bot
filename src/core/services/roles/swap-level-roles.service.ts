import { db } from "@/lib/db";
import { memberMessages, memberRole, syncProgress } from "@/lib/db-schema";
import { COPY_PASTER, SCRIPT_KIDDIE } from "@/shared/config/roles";
import { logTs } from "@/shared/utils/date.utils";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Guild, type GuildTextBasedChannel } from "discord.js";

export class SwapLevelRolesService {
  private static runningGuilds = new Set<string>();

  static isSwapRunning(guildId: string): boolean {
    return this.runningGuilds.has(guildId);
  }

  static async swapLevelRoles(
    discordGuild: Guild,
    channel: GuildTextBasedChannel
  ): Promise<void> {
    const guildName = discordGuild.name.slice(0, 20);

    if (this.runningGuilds.has(discordGuild.id)) {
      await channel.send("❌ Role swap already running.");
      return;
    }

    this.runningGuilds.add(discordGuild.id);

    try {
      // Find the Discord roles by name
      const copyPasterRole = discordGuild.roles.cache.find(
        (r) => r.name.toLowerCase() === "copy paster!"
      );
      const scriptKiddieRole = discordGuild.roles.cache.find(
        (r) => r.name.toLowerCase() === "script kiddie!"
      );

      if (!copyPasterRole || !scriptKiddieRole) {
        await channel.send(
          "❌ Could not find 'copy paster!' or 'script kiddie!' roles in this server."
        );
        return;
      }

      logTs(
        "info",
        guildName,
        `Found roles - Copy Paster: ${copyPasterRole.id}, Script Kiddie: ${scriptKiddieRole.id}`
      );

      // Get all members with either role from the database
      const usersWithRoles = await db
        .select({
          memberId: memberRole.memberId,
          guildId: memberRole.guildId,
          roleId: memberRole.roleId,
          name: memberRole.name,
        })
        .from(memberRole)
        .where(
          and(
            eq(memberRole.guildId, discordGuild.id),
            inArray(memberRole.roleId, [copyPasterRole.id, scriptKiddieRole.id])
          )
        );

      if (usersWithRoles.length === 0) {
        await channel.send("✅ No users found with these roles. Nothing to swap.");
        return;
      }

      // Load saved progress
      const saved = await db.query.syncProgress.findFirst({
        where: and(
          eq(syncProgress.guildId, discordGuild.id),
          eq(syncProgress.type, "swap-roles")
        ),
      });
      const processedIds = new Set(saved?.processedIds ?? []);
      const failedIds = new Set(saved?.failedIds ?? []);

      // Filter out already processed members
      const remaining = usersWithRoles.filter(
        (u) => !processedIds.has(u.memberId)
      );
      const total = usersWithRoles.length;
      const alreadyDone = processedIds.size;

      const resumeMsg =
        alreadyDone > 0 ? ` (resuming: ${alreadyDone}/${total} done)` : "";
      logTs(
        "info",
        guildName,
        `Processing ${remaining.length} users${resumeMsg}`
      );

      const progressMsg = await channel.send(
        `🔄 Swapping roles for ${total} users${resumeMsg}...\n\n` +
          `**New role assignments:**\n` +
          `• 10-99 messages → Script Kiddie!\n` +
          `• 100+ messages → Copy Paster!`
      );

      let swapCount = 0;
      let noChangeCount = 0;

      for (let i = 0; i < remaining.length; i++) {
        const user = remaining[i];
        const tag = `Member ${user.memberId}`;

        try {
          // Count messages for this user
          const messageCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(memberMessages)
            .where(
              and(
                eq(memberMessages.memberId, user.memberId),
                eq(memberMessages.guildId, discordGuild.id)
              )
            );

          const count = messageCount[0]?.count || 0;

          // Determine correct role based on message count
          let correctRoleId: string;
          let correctRoleName: string;

          if (count >= 100) {
            // 100+ messages → Copy Paster (new level 2)
            correctRoleId = copyPasterRole.id;
            correctRoleName = "Copy Paster!";
          } else if (count >= 10) {
            // 10-99 messages → Script Kiddie (new level 1)
            correctRoleId = scriptKiddieRole.id;
            correctRoleName = "Script Kiddie!";
          } else {
            // Less than 10 messages → shouldn't have either role
            logTs(
              "warn",
              guildName,
              `⚠️ ${tag} has ${count} messages (< 10) but has role ${user.name}. Skipping...`
            );
            processedIds.add(user.memberId);
            noChangeCount++;
            continue;
          }

          // Check if they need to be swapped
          if (user.roleId !== correctRoleId) {
            // Get the Discord member
            const discordMember = await discordGuild.members.fetch(
              user.memberId
            );

            if (!discordMember) {
              logTs("warn", guildName, `${tag} not found in guild. Skipping...`);
              failedIds.add(user.memberId);
              continue;
            }

            // Remove old role and add new role
            const oldRole =
              user.roleId === copyPasterRole.id
                ? copyPasterRole
                : scriptKiddieRole;
            const newRole =
              correctRoleId === copyPasterRole.id
                ? copyPasterRole
                : scriptKiddieRole;

            if (discordMember.roles.cache.has(oldRole.id)) {
              await discordMember.roles.remove(oldRole.id);
            }

            if (!discordMember.roles.cache.has(newRole.id)) {
              await discordMember.roles.add(newRole.id);
            }

            swapCount++;
            logTs(
              "info",
              guildName,
              `🔄 ${tag} (${count} messages) ${user.name} → ${correctRoleName}`
            );
          } else {
            noChangeCount++;
            logTs(
              "info",
              guildName,
              `✓ ${tag} (${count} messages) already has ${correctRoleName}`
            );
          }

          processedIds.add(user.memberId);
        } catch (err) {
          failedIds.add(user.memberId);
          const msg = err instanceof Error ? err.message : String(err);
          logTs("error", guildName, `✗ ${tag}: ${msg}`);
        }

        const done = alreadyDone + i + 1;

        // Save progress
        await db
          .insert(syncProgress)
          .values({
            guildId: discordGuild.id,
            type: "swap-roles",
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

        // Update Discord message every 10 users or at the end
        if ((i + 1) % 10 === 0 || i + 1 === remaining.length) {
          const pct = Math.round((done / total) * 100);
          await progressMsg
            .edit(
              `🔄 Swapping roles: ${done}/${total} (${pct}%)\n\n` +
                `**Progress:**\n` +
                `• Swapped: ${swapCount}\n` +
                `• No change: ${noChangeCount}\n` +
                `• Failed: ${failedIds.size}`
            )
            .catch(() => {});
        }
      }

      // Clear progress on completion
      await db
        .delete(syncProgress)
        .where(
          and(
            eq(syncProgress.guildId, discordGuild.id),
            eq(syncProgress.type, "swap-roles")
          )
        )
        .catch(() => {});

      const result =
        `✅ **Role swap complete!**\n\n` +
        `**Results:**\n` +
        `• Total processed: ${total}\n` +
        `• Swapped: ${swapCount}\n` +
        `• No change needed: ${noChangeCount}\n` +
        `• Failed: ${failedIds.size}\n\n` +
        `**Next steps:**\n` +
        `1. Update Discord role order in Server Settings\n` +
        `2. Update role colors if needed`;

      await progressMsg.edit(result).catch(() => {});
      logTs("info", guildName, `Role swap complete: ${swapCount} swapped, ${noChangeCount} unchanged`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTs("error", guildName, `Role swap failed: ${msg}`);
      await channel.send(`❌ Error: ${msg}. Run \`!swap-level-roles\` again to resume.`);
      throw err;
    } finally {
      this.runningGuilds.delete(discordGuild.id);
    }
  }
}
