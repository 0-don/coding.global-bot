import { PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';

const prisma = new PrismaClient();

export const updateDbRoles = async (
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember
) => {
  const oldRoles = oldMember.roles.cache
    .filter((role) => role.name !== '@everyone')
    .map((role) => role);
  const newRoles = newMember.roles.cache
    .filter((role) => role.name !== '@everyone')
    .map((role) => role);

  if (newRoles.length > oldRoles.length) {
    const newAddedRole = newRoles.filter((role) => !oldRoles.includes(role))[0];
    if (!newAddedRole) return;

    await prisma.userRoles.create({
      data: { userId: newMember.id, roleId: newAddedRole.id },
    });
  } else if (newRoles.length < oldRoles.length) {
    const newRemovedRole = oldRoles.filter(
      (role) => !newRoles.includes(role)
    )[0];
    if (!newRemovedRole) return;

    await prisma.userRoles.deleteMany({
      where: { roleId: newRemovedRole.id, userId: newMember.id },
    });
  }
};
