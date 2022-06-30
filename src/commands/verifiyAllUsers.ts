import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction, Role } from 'discord.js';
import type { StatusRoles } from '../types/types';
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

    // create a guild role key object pair
    let guildStatusRoles: {
      [x: string]: Role | undefined;
    } = {};
    for (let role of statusRoles)
      guildStatusRoles[role] = interaction.guild?.roles.cache.find(
        ({ name }) => name === role
      );

    await interaction.deferReply({ ephemeral: true });

    // if one of the roles is missing, return
    if (statusRoles.some((role) => !guildStatusRoles[role])) {
      const content = statusRoles
        .map(
          (role) =>
            `${role}: ${new Boolean(!!guildStatusRoles[role]).toString()}`
        )
        .join('\n');
      return interaction.editReply({ content });
    }

    // loop over all guild members
    for (let memberCollection of members) {
      // get the user from map collection
      const member = memberCollection[1];

      log(member.user.username);

      // check if user exists in db
      const dbUser = await prisma.user.findFirst({
        where: { userId: { equals: member.id } },
        include: { roles: true },
      });

      // create if not exist
      if (!dbUser) {
        await prisma.user.create({
          data: {
            userId: member.id,
            username: member.user.username,
            guildId: member.guild.id,
          },
        });
      } else {
        // asign previously created roles to user
        dbUser.roles.forEach((role) => {
          member.roles.add(role.roleId);
        });
      }

      // refetch user if some roles were reasinged
      await member.fetch();

      // if one of the status roles is on user, continue
      if (
        statusRoles.some((role) => {
          member.roles.cache.has(guildStatusRoles[role]!.id);
        }) ||
        member.user.bot
      )
        continue;

      // verify user
      await member.roles.add(guildStatusRoles['verified' as StatusRoles]!.id);
    }

    return interaction.editReply({ content: 'All users verified' });
  },
};
