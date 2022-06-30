import { PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { EVERYONE } from '../constants';

const prisma = new PrismaClient();

export const updateDbRoles = async (
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember
) => {
  const oldRoles = oldMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role);
  const newRoles = newMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role);

  if (newRoles.length > oldRoles.length) {
    // add or update new role
    const newAddedRole = newRoles.filter((role) => !oldRoles.includes(role))[0];
    if (!newAddedRole) return;

    // create role in db if i can update it
    if (newAddedRole.editable) {
      await prisma.userRoles.upsert({
        where: {
          user_role_unique: {
            roleId: newAddedRole.id,
            userId: newMember.id,
          },
        },
        create: {
          roleId: newAddedRole.id,
          userId: newMember.id,
          name: newAddedRole.name,
        },
        update: {
          roleId: newAddedRole.id,
          userId: newMember.id,
          name: newAddedRole.name,
        },
      });
    }
  } else if (newRoles.length < oldRoles.length) {
    // remove role
    const newRemovedRole = oldRoles.filter(
      (role) => !newRoles.includes(role)
    )[0];
    if (!newRemovedRole) return;

    try {
      await prisma.userRoles.delete({
        where: {
          user_role_unique: {
            roleId: newRemovedRole.id,
            userId: newMember.id,
          },
        },
      });
    } catch (_) {}
  }
};
