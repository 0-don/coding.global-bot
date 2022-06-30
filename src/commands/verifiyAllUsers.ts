import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import { statusRoles, VERIFIED } from '../utils/constants';
import { getGuildStatusRoles } from '../utils/roles/getGuildStatusRoles';

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
    let guildStatusRoles = getGuildStatusRoles(interaction.guild);

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
      const dbUser = await prisma.member.findFirst({
        where: { memberId: { equals: member.id } },
        include: { roles: true },
      });

      // create if not exist
      if (!dbUser) {
        await prisma.member.create({
          data: {
            memberId: member.id,
            guildId: member.guild.id,
            username: member.user.username,
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
      await member.roles.add(guildStatusRoles[VERIFIED]!.id);
    }

    return interaction.editReply({ content: 'All users verified' });
  },
};
