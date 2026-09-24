import { db } from "@/lib/db";
import { memberRole, memberMessages, memberHelper } from "@/lib/db-schema";
import { and, count, eq, ne } from "drizzle-orm";
import { LEVEL_LIST } from "@/shared/config/levels";
import {
  HELPER_RANKING,
  HELPER_ROLES,
  JAIL,
  LEVEL_ROLES,
  STATUS_ROLES,
  VOICE_ONLY,
} from "@/shared/config/roles";
import { ConfigValidator } from "@/shared/config/validator";
import { findRoleChangeActor } from "@/core/services/moderation/audit-log";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { HandleHelperReactionParams, UpdateDbRolesArgs } from "@/types";
import {
  Guild,
  GuildMember,
  Message,
  PartialGuildMember,
  Role,
  TextChannel,
} from "discord.js";

export class RolesService {
  private static _helperSystemWarningLogged = false;

  /**
   * Record a jail or release done by adding or removing the jail role by hand,
   * rather than through /jail or /unjail.
   *
   * The commands write their own ModLog entry, so without this anyone who
   * simply drags the role on or off leaves no record at all. The audit log is
   * the only thing that says who made the change.
   *
   * Callers decide whether the change was manual from the MemberRole rows as
   * they stood before this event: every path where the bot applies the jail
   * role writes the jail row first, and /unjail deletes it first, so the DB
   * already agrees with any change the bot made. Only a disagreement is a
   * manual change. That holds without the audit log, and without racing the
   * command's own ModLog insert.
   */
  private static async logManualJailChange(
    newMember: GuildMember | PartialGuildMember,
    jailRoleId: string,
    action: "jail" | "unjail",
  ) {
    const actor = await findRoleChangeActor(
      newMember.guild,
      newMember.id,
      jailRoleId,
      action === "jail" ? "$add" : "$remove",
    );

    // Belt and braces: a bot-made change the DB check above did not catch.
    const botId = newMember.client.user?.id;
    if (actor?.moderatorId && botId && actor.moderatorId === botId) return;

    await ModLogService.postLog({
      guild: newMember.guild,
      action,
      targetId: newMember.id,
      targetName: newMember.user.username,
      moderatorId: actor?.moderatorId,
      moderatorName: actor?.moderatorName,
      moderatorFromAuditLog: true,
      reason:
        actor?.reason ??
        (action === "jail"
          ? "Jail role applied manually"
          : "Jail role removed manually"),
    });
  }

  static async updateDbRoles(args: UpdateDbRolesArgs) {
    // check if new role was added
    if (
      (args.oldMember.flags.bitfield === 9 &&
        args.newMember.flags.bitfield === 11) ||
      args.oldMember.pending ||
      args.newMember.pending
    )
      return;

    if (args.newRoles.length > args.oldRoles.length) {
      // Check for restricted roles (JAIL or VOICE_ONLY)
      const jailId = args.guildRoles.find((role) => role.name === JAIL)?.id;
      const voiceOnlyId = args.guildRoles.find(
        (role) => role.name === VOICE_ONLY,
      )?.id;

      const jailDbRole = args.memberDbRoles.find(
        (dbRole) => dbRole.roleId === jailId,
      );
      const voiceOnlyDbRole = args.memberDbRoles.find(
        (dbRole) => dbRole.roleId === voiceOnlyId,
      );

      // If user has JAIL or VOICE_ONLY role, don't add new roles
      if (jailDbRole || voiceOnlyDbRole) return;

      // add or update new role
      const newAddedRole = args.newRoles.filter(
        (role) => !args.oldRoles.includes(role),
      )[0];
      if (!newAddedRole) return;

      const roleData = {
        roleId: newAddedRole.id,
        memberId: args.newMember.id,
        name: newAddedRole.name,
        guildId: args.newMember.guild.id,
      };

      await db
        .insert(memberRole)
        .values(roleData)
        .onConflictDoUpdate({
          target: [memberRole.memberId, memberRole.roleId],
          set: roleData,
        })
        .catch(() => {});
    }
    if (args.newRoles.length < args.oldRoles.length) {
      // Tested by name against both lists rather than via newRemovedRole
      // below, which only reports the first removal.
      const releasedJailRole = args.oldRoles.find(
        (role) =>
          role.name === JAIL && !args.newRoles.some((r) => r.id === role.id),
      );

      // /unjail deletes the jail row before removing the role, so a row still
      // here means someone took the role off by hand.
      if (
        releasedJailRole &&
        args.memberDbRoles.some((r) => r.roleId === releasedJailRole.id)
      )
        RolesService.logManualJailChange(
          args.newMember,
          releasedJailRole.id,
          "unjail",
        ).catch(() => {});

      // get the removed role
      const newRemovedRole = args.oldRoles.find(
        (role) => !args.newRoles.includes(role),
      );

      // if no role was removed return
      if (!newRemovedRole) return;

      // try catch delete removed role from db
      await db
        .delete(memberRole)
        .where(
          and(
            eq(memberRole.memberId, args.newMember.id),
            eq(memberRole.roleId, newRemovedRole.id),
          ),
        )
        .catch(() => {});
    }
  }

  static async updateStatusRoles(args: UpdateDbRolesArgs) {
    // onboarding question bypass
    if (
      (args.oldMember.flags.bitfield === 9 &&
        args.newMember.flags.bitfield === 11) ||
      args.oldMember.pending ||
      args.newMember.pending
    ) {
      // Find restricted roles (JAIL or VOICE_ONLY)
      const restrictedRoleNames = [JAIL, VOICE_ONLY];
      const dbRestrictedRole = args.memberDbRoles.find(
        (dbRole) =>
          dbRole.roleId ===
          args.guildRoles.find((role) =>
            restrictedRoleNames.includes(role.name),
          )?.id,
      );

      if (dbRestrictedRole) {
        const restrictedRoleName = args.guildRoles.find(
          (role) => role.id === dbRestrictedRole.roleId,
        )?.name;

        // guard against undefined role name to avoid stripping the restricted role
        if (restrictedRoleName) {
          for (const role of args.newMember.roles.cache.values()) {
            if (role.name === restrictedRoleName) continue;
            await args.newMember.roles.remove(role).catch(() => {});
          }

          if (
            !args.newMember.roles.cache.some(
              (role) => role.name === restrictedRoleName,
            )
          )
            await args.newMember.roles
              .add(dbRestrictedRole.roleId)
              .catch(() => {});

          await db
            .delete(memberRole)
            .where(
              and(
                eq(memberRole.memberId, args.newMember.id),
                eq(memberRole.guildId, args.newMember.guild.id),
                ne(memberRole.roleId, dbRestrictedRole.roleId),
              ),
            );
        }

        return;
      }

      return;
    }

    // Only run if user has a new role
    if (args.oldRoles.length >= args.newRoles.length) return;

    const newRoles = args.newRoles.map((role) => role.name);
    const oldRoles = args.oldRoles.map((role) => role.name);
    const newAddedRole = newRoles.find((role) => !oldRoles.includes(role))!;

    // Handle JAIL or VOICE_ONLY role addition
    if (newAddedRole === JAIL || newAddedRole === VOICE_ONLY) {
      // Every path where the bot applies the jail role (/delete-user-messages,
      // /warn, the automod, rejoin and onboarding re-application,
      // !verify-users) writes the jail row first, so only a jail with no row
      // behind it was done by hand.
      const jailRoleId = args.guildRoles.find((role) => role.name === JAIL)?.id;
      if (
        newAddedRole === JAIL &&
        jailRoleId &&
        !args.memberDbRoles.some((r) => r.roleId === jailRoleId)
      )
        RolesService.logManualJailChange(
          args.newMember,
          jailRoleId,
          "jail",
        ).catch(() => {});

      args.newMember.roles.cache.forEach(
        (role) =>
          role.name !== newAddedRole &&
          args.newMember.roles.remove(role).catch(() => {}),
      );

      // resolve role ID from guild cache (more reliable than member cache)
      const restrictedRoleId = args.guildRoles.find(
        (role) => role.name === newAddedRole,
      )?.id;

      // guard against undefined role ID to avoid nuking all DB roles
      if (restrictedRoleId) {
        await db
          .delete(memberRole)
          .where(
            and(
              eq(memberRole.memberId, args.newMember.id),
              eq(memberRole.guildId, args.newMember.guild.id),
              ne(memberRole.roleId, restrictedRoleId),
            ),
          );
      }

      return;
    }

    // Check if role is a status role; if yes, remove unused status roles
    if (STATUS_ROLES.includes(newAddedRole)) {
      args.newMember.roles.cache.forEach(
        (role) =>
          newAddedRole !== role.name &&
          STATUS_ROLES.includes(role.name) &&
          args.newMember.roles.remove(role),
      );
    }

    // Check if level roles are added
    if (LEVEL_ROLES.includes(newAddedRole)) {
      const levelRole = LEVEL_LIST.find((role) => role.role === newAddedRole);
      if (!levelRole) return;

      const [result] = await db
        .select({ count: count() })
        .from(memberMessages)
        .where(
          and(
            eq(memberMessages.memberId, args.newMember?.id),
            eq(memberMessages.guildId, args.newMember?.guild?.id),
          ),
        );

      const memberMessagesCount = result?.count ?? 0;
      const role = args.newMember.guild.roles.cache.find(
        (role) => role.name === newAddedRole,
      );
      if (memberMessagesCount < levelRole.count && role) {
        args.newMember.roles.remove(role);
      }
    }
  }

  static getGuildStatusRoles(guild: Guild) {
    let guildStatusRoles: {
      [x: string]: Role | undefined;
    } = {};
    //check for verified roles "verified", "voiceOnly", "readOnly", "mute"
    for (let role of STATUS_ROLES)
      guildStatusRoles[role] = guild?.roles.cache.find(
        ({ name }) => name === role,
      );
    return guildStatusRoles;
  }

  static async handleHelperReaction(
    params: HandleHelperReactionParams,
  ): Promise<boolean> {
    if (params.threadOwnerId !== params.thankerUserId) return false;
    if (params.helperId === params.thankerUserId) return false;

    const isHelpedThread = await db.query.memberHelper.findFirst({
      where: and(
        eq(memberHelper.threadId, params.threadId),
        eq(memberHelper.threadOwnerId, params.threadOwnerId),
      ),
    });
    if (isHelpedThread) return false;

    await db.insert(memberHelper).values({
      memberId: params.helperId,
      guildId: params.guildId,
      threadId: params.threadId,
      threadOwnerId: params.threadOwnerId,
    });

    await RolesService.helperRoleChecker(params.message);
    return true;
  }

  static async helperRoleChecker(message: Message<boolean>) {
    if (!ConfigValidator.isFeatureEnabled("HELPER_ROLES")) {
      if (!this._helperSystemWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Helper Role System",
          "HELPER_ROLES",
        );
        this._helperSystemWarningLogged = true;
      }
      return;
    }

    const guildMember = message.member!.partial
      ? await message.member!.fetch()
      : message.member!;
    const memberRoles = guildMember.roles.cache;

    const [result] = await db
      .select({ count: count() })
      .from(memberHelper)
      .where(eq(memberHelper.memberId, guildMember.id));

    const helpCount = result?.count ?? 0;

    //check if user has helper role
    const hasHelperRole = memberRoles.some((role) =>
      HELPER_ROLES.includes(role.name as (typeof HELPER_ROLES)[number]),
    );
    if (!hasHelperRole) return;

    //remove roles
    for (const role of memberRoles.values()) {
      if (HELPER_ROLES.includes(role.name as (typeof HELPER_ROLES)[number])) {
        try {
          await guildMember.roles.remove(role);
        } catch (_) {}
      }
    }

    //add role
    const helperRole = HELPER_RANKING.find((role) => role.points <= helpCount);
    if (helperRole) {
      try {
        const roleToAdd = memberRoles.get(helperRole.name);
        if (!roleToAdd || !roleToAdd.editable) return;

        await guildMember.roles.add(helperRole.name);
      } catch (_) {}
      (message.channel as TextChannel).send(
        `Congratulations ${guildMember.toString()} you are now ${
          helperRole.name
        } 🎉`,
      );
    }
  }
}
