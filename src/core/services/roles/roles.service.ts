import {
  Collection,
  Guild,
  GuildMember,
  MessageReaction,
  PartialGuildMember,
  PartialMessageReaction,
  PartialUser,
  Role,
  User,
} from "discord.js";
import { MemberRole, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/prisma";
import { StatusRoles } from "@/types";
import {
  JAIL,
  LEVEL_LIST,
  LEVEL_ROLES,
  STATUS_ROLES,
  VERIFIED,
  VERIFY_TEMPLATE,
  VOICE_ONLY,
} from "@/shared/config";

export type UpdateDbRolesArgs = {
  oldRoles: Role[];
  newRoles: Role[];
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember | PartialGuildMember;
  guildRoles: Collection<string, Role>;
  memberDbRoles: MemberRole[];
};

export class RolesService {
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

  static async verify(
    member: GuildMember | PartialGuildMember,
    role: StatusRoles,
  ) {
    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(member.guild);

    // if icon reaction role exist exist add role to user
    const guildRole = guildStatusRoles[role];
    if (guildRole && guildRole?.editable) {
      await member.roles.add(guildRole);
    }
  }

  static async verifyReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    // check if template
    const isTemplate = reaction.message.embeds[0]?.footer?.text;

    // check embed template a verify template
    if (isTemplate !== VERIFY_TEMPLATE) return;
    // check if reaction is from bot
    if (user.bot) return;

    // get member
    const member = await reaction.message.guild?.members.cache
      .get(user.id)
      ?.fetch();

    const memberDbRoles = await prisma.memberRole.findMany({
      where: { memberId: user.id },
    });

    const guildRoles = reaction.message.guild?.roles.cache.filter((role) =>
      memberDbRoles.some((dbRole) => dbRole.roleId === role.id),
    );

    // if jail role exist then exit
    if (guildRoles?.find(({ name }) => name === JAIL)) return;

    // if icon reaction role on user then exit
    if (
      member?.roles.cache.some((role) =>
        [VERIFIED, JAIL, VOICE_ONLY].includes(role.name as any),
      )
    )
      return;

    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(
      reaction.message.guild!,
    );

    const guildRole = guildStatusRoles[VERIFIED];
    if (guildRole && guildRole.editable) {
      await member?.roles.add(guildStatusRoles[VERIFIED] as Role);
    }
  }
}
