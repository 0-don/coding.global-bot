import { MemberRole, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/prisma";
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
import {
  Collection,
  Guild,
  GuildMember,
  Message,
  PartialGuildMember,
  Role,
  TextChannel,
} from "discord.js";

export type UpdateDbRolesArgs = {
  oldRoles: Role[];
  newRoles: Role[];
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember | PartialGuildMember;
  guildRoles: Collection<string, Role>;
  memberDbRoles: MemberRole[];
};

export interface HandleHelperReactionParams {
  threadId: string;
  threadOwnerId: string | null;
  helperId: string;
  thankerUserId: string;
  guildId: string;
  message: Message;
}

export class RolesService {
  private static _helperSystemWarningLogged = false;
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

      const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
        roleId: newAddedRole.id,
        memberId: args.newMember.id,
        name: newAddedRole.name,
        guildId: args.newMember.guild.id,
      };

      prisma.memberRole
        .upsert({
          where: {
            member_role: {
              memberId: memberRole.memberId,
              roleId: memberRole.roleId,
            },
          },
          create: memberRole,
          update: memberRole,
        })
        .catch(() => {});
    }
    if (args.newRoles.length < args.oldRoles.length) {
      // get the removed role
      const newRemovedRole = args.oldRoles.find(
        (role) => !args.newRoles.includes(role),
      );

      // if no role was removed return
      if (!newRemovedRole) return;

      // try catch delete removed role from db
      prisma.memberRole
        .delete({
          where: {
            member_role: {
              memberId: args.newMember.id,
              roleId: newRemovedRole.id,
            },
          },
        })
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

        // Remove all roles except the restricted one
        for (const role of args.newMember.roles.cache.values()) {
          if (role.name === restrictedRoleName) continue;
          await args.newMember.roles.remove(role).catch(() => {});
        }

        // Add restricted role if not on user
        if (
          !args.newMember.roles.cache.some(
            (role) => role.name === restrictedRoleName,
          )
        )
          args.newMember.roles.add(dbRestrictedRole.roleId).catch(() => {});

        prisma.memberRole.deleteMany({
          where: {
            memberId: args.newMember.id,
            guildId: args.newMember.guild.id,
            roleId: { not: dbRestrictedRole?.roleId },
          },
        });

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
      const restrictedRole = args.newMember.roles.cache.find(
        (role) => role.name === newAddedRole,
      );

      args.newMember.roles.cache.forEach(
        (role) =>
          role.name !== newAddedRole &&
          args.newMember.roles.remove(role).catch(() => {}),
      );

      return await prisma.memberRole.deleteMany({
        where: {
          memberId: args.newMember.id,
          guildId: args.newMember.guild.id,
          roleId: { not: restrictedRole?.id },
        },
      });
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

      const memberMessages = await prisma.memberMessages.count({
        where: {
          memberId: args.newMember?.id,
          guildId: args.newMember?.guild?.id,
        },
      });
      const role = args.newMember.guild.roles.cache.find(
        (role) => role.name === newAddedRole,
      );
      if (memberMessages < levelRole.count && role) {
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

    const isHelpedThread = await prisma.memberHelper.findFirst({
      where: { threadId: params.threadId, threadOwnerId: params.threadOwnerId },
    });
    if (isHelpedThread) return false;

    await prisma.memberHelper.create({
      data: {
        memberId: params.helperId,
        guildId: params.guildId,
        threadId: params.threadId,
        threadOwnerId: params.threadOwnerId,
      },
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
    const helpCount = await prisma.memberHelper.count({
      where: { memberId: guildMember.id },
    });

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
