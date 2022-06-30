import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import { statusRoles } from '../utils/constants';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('verify-all-users')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    await interaction.guild?.members.fetch();
    await interaction.guild?.roles.fetch();
    const members = interaction.guild?.members.cache;

    if (!members) return;

    const allStatusRoles = statusRoles.map((role) => ({
      [role]: interaction.guild?.roles.cache.find((r) => r.name === role),
    }));

    await interaction.deferReply({ ephemeral: true });

    if (statusRoles.some((role) => !allStatusRoles[role])) {
      const content = statusRoles
        .map(
          (role) => `${role}: ${new Boolean(!!allStatusRoles[role]).toString()}`
        )
        .join('\n');
      return interaction.editReply({ content });
    }

    for (let memberCollection of members) {
      const member = memberCollection[1];
      const dbUser = await prisma.user.findFirst({
        where: { userId: { equals: member.id } },
        include: { roles: true },
      });

      if (!dbUser) {
        await prisma.user.create({
          data: {
            userId: member.id,
            username: member.user.username,
            guildId: member.guild.id,
          },
        });
      } else {
        dbUser.roles.forEach((role) => {
          member.roles.add(role.roleId);
        });
      }

      if (
        statusRoles.some((role) => {
          member.roles.cache.has(allStatusRoles[role].id);
        }) ||
        member.user.bot
      )
        continue;

      log(member.user.username);
      await member.roles.add(allStatusRoles['verified'].id);
    }

    return interaction.editReply({ content: 'All users verified' });
  },
};
