import type { Prisma } from "@prisma/client";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../../prisma.js";
import { EVERYONE } from "../constants.js";

export const updateDbRoles = async (
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember,
) => {
  // get new roles as string[]
  const newRoles = newMember.roles.cache.filter(({ name }) => name !== EVERYONE).map((role) => role);
  // get old roles as string[]
  const oldRoles = oldMember.roles.cache.filter(({ name }) => name !== EVERYONE).map((role) => role);

  if (oldMember.flags.bitfield === 9 && newMember.flags.bitfield === 11) return;

  // check if new role was aded
  if (newRoles.length > oldRoles.length) {
    // add or update new role
    const newAddedRole = newRoles.filter((role) => !oldRoles.includes(role))[0];
    if (!newAddedRole) return;

    // create role in db if i can update it
    if (newAddedRole.editable) {
      const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
        roleId: newAddedRole.id,
        memberId: newMember.id,
        guildId: newMember.guild.id,
      };
      try {
        await prisma.memberRole.upsert({
          where: {
            member_role: {
              memberId: memberRole.memberId,
              roleId: memberRole.roleId,
            },
          },
          create: memberRole,
          update: memberRole,
        });
      } catch (_) {}
    }
    // remove role
  } else if (newRoles.length < oldRoles.length) {
    // get the removed role
    const newRemovedRole = oldRoles.filter((role) => !newRoles.includes(role))[0];

    // if no role was removed return
    if (!newRemovedRole) return;

    // try catch delete removed role from db
    try {
      await prisma.memberRole.delete({
        where: {
          member_role: {
            memberId: newMember.id,
            roleId: newRemovedRole.id,
          },
        },
      });
    } catch (_) {}
  }
};
