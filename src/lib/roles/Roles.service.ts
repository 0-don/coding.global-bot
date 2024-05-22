import { MemberRole, Prisma } from "@prisma/client";
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
import { prisma } from "../../prisma.js";
import { StatusRoles } from "../../types/index.js";
import {
  JAIL,
  STATUS_ROLES,
  VERIFIED,
  VERIFY_TEMPLATE,
  VOICE_ONLY,
} from "../constants.js";

export type UpdateDbRolesArgs = {
  oldRoles: Role[];
  newRoles: Role[];
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember | PartialGuildMember;
  guildRoles: Collection<string, Role>;
  memberDbRoles: MemberRole[];
};

export class RolesService {
  static updateDbRoles(args: UpdateDbRolesArgs) {
    // check if new role was aded
    if (
      (args.oldMember.flags.bitfield === 9 &&
        args.newMember.flags.bitfield === 11) ||
      args.oldMember.pending ||
      args.newMember.pending
    )
      return;

    if (args.newRoles.length > args.oldRoles.length) {
      const jailId = args.guildRoles.find((role) => role.name === JAIL)?.id;
      const jailDbRole = args.memberDbRoles.find(
        (dbRole) => dbRole.roleId === jailId
      );

      if (jailDbRole) return;

      // add or update new role
      const newAddedRole = args.newRoles.filter(
        (role) => !args.oldRoles.includes(role)
      )[0];
      if (!newAddedRole) return;

      // create role in db if i can update it
      if (newAddedRole.editable) {
        const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
          roleId: newAddedRole.id,
          memberId: args.newMember.id,
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
      // remove role
    } else if (args.newRoles.length < args.oldRoles.length) {
      // get the removed role
      const newRemovedRole = args.oldRoles.find(
        (role) => !args.newRoles.includes(role)
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
      const dbJailRole = args.memberDbRoles.find(
        (dbRole) =>
          dbRole.roleId ===
          args.guildRoles.find((role) => role.name === JAIL)?.id
      );

      if (dbJailRole) {
        //remove all roles
        for (const role of args.newMember.roles.cache.values()) {
          if (role.name === JAIL) continue;
          await args.newMember.roles.remove(role).catch(() => {});
        }

        //add only if not on user
        if (!args.newMember.roles.cache.some((role) => role.name === JAIL))
          args.newMember.roles.add(dbJailRole.roleId).catch(() => {});

        prisma.memberRole.deleteMany({
          where: {
            memberId: args.newMember.id,
            guildId: args.newMember.guild.id,
            roleId: { not: dbJailRole?.roleId },
          },
        });
      }

      return;
    }
    // only run if user has a new role
    if (args.oldRoles.length >= args.newRoles.length) return;

    const newRoles = args.newRoles.map((role) => role.name);
    const oldRoles = args.oldRoles.map((role) => role.name);
    const newAddedRole = newRoles.find(
      (role) => !oldRoles.includes(role)
    ) as StatusRoles;

    if (newRoles.includes(JAIL) && !STATUS_ROLES.includes(newAddedRole)) {
      const jailRole = args.newMember.roles.cache.find(
        (role) => role.name === JAIL
      );

      args.newMember.roles.cache.forEach(
        (role) =>
          role.name !== JAIL &&
          args.newMember.roles.remove(role).catch(() => {})
      );

      prisma.memberRole.deleteMany({
        where: {
          memberId: args.newMember.id,
          guildId: args.newMember.guild.id,
          roleId: { not: jailRole?.id },
        },
      });
      return;
    }

    // check if role is a status role if yes then remove the unused status role
    if (STATUS_ROLES.includes(newAddedRole)) {
      args.newMember.roles.cache.forEach(
        (role) =>
          newAddedRole !== role.name &&
          STATUS_ROLES.includes(role.name) &&
          args.newMember.roles.remove(role)
      );
    }
  }

  static getGuildStatusRoles(guild: Guild) {
    let guildStatusRoles: {
      [x: string]: Role | undefined;
    } = {};
    //check for verified roles "verified", "voiceOnly", "readOnly", "mute", "unverified"
    for (let role of STATUS_ROLES)
      guildStatusRoles[role] = guild?.roles.cache.find(
        ({ name }) => name === role
      );
    return guildStatusRoles;
  }

  static async verify(
    member: GuildMember | PartialGuildMember,
    role: StatusRoles
  ) {
    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(member.guild);

    // if icon reaction role exist exist add role to user
    guildStatusRoles[role] && (await member.roles.add(guildStatusRoles[role]!));
  }

  static async verifyReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
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
      memberDbRoles.some((dbRole) => dbRole.roleId === role.id)
    );

    // if jail role exist then exit
    if (guildRoles?.find(({ name }) => name === JAIL)) return;

    // if icon reaction role on user then exit
    if (
      member?.roles.cache.some((role) =>
        [VERIFIED, JAIL, VOICE_ONLY].includes(role.name as any)
      )
    )
      return;

    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(
      reaction.message.guild!
    );

    // if icon reaction role exist exist add role to user
    guildStatusRoles[VERIFIED] &&
      member?.roles.add(guildStatusRoles[VERIFIED] as Role);
  }
}
