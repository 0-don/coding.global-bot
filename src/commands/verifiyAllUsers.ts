import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';

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
    const members = interaction.guild?.members.cache;

    if (!members) return;

    await interaction.guild?.roles.fetch();

    const verifiedRole = interaction.guild?.roles.cache.find(
      (role) => role.name === 'verified'
    );
    const voiceOnlyRole = interaction.guild?.roles.cache.find(
      (role) => role.name === 'voiceOnly'
    );
    const readOnlyRole = interaction.guild?.roles.cache.find(
      (role) => role.name === 'readOnly'
    );
    const mutedRole = interaction.guild?.roles.cache.find(
      (role) => role.name === 'mute'
    );
    const unverifiedRole = interaction.guild?.roles.cache.find(
      (role) => role.name === 'unverified'
    );

    await interaction.deferReply({ ephemeral: true });

    if (
      !verifiedRole ||
      !voiceOnlyRole ||
      !readOnlyRole ||
      !mutedRole ||
      !unverifiedRole
    ) {
      return interaction.editReply({
        content: `verified: ${new Boolean(
          !!verifiedRole
        ).toString()}\nvoiceOnly: ${new Boolean(
          !!voiceOnlyRole
        ).toString()}\nreadOnly: ${new Boolean(
          !!readOnlyRole
        ).toString()}\nmute: ${new Boolean(
          !!mutedRole
        ).toString()}\nunverified: ${new Boolean(!!unverifiedRole).toString()}`,
      });
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

      if (member.user.bot) continue;
      if (member.roles.cache.has(verifiedRole.id)) continue;
      if (member.roles.cache.has(voiceOnlyRole.id)) continue;
      if (member.roles.cache.has(readOnlyRole.id)) continue;
      if (member.roles.cache.has(mutedRole.id)) continue;
      if (member.roles.cache.has(unverifiedRole.id)) continue;
      log(member.user.username);
      await member.roles.add(verifiedRole);
    }

    return interaction.editReply({ content: 'All users verified' });
  },
};
