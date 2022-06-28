import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';

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

      if (member.user.bot) continue;
      if (member.roles.cache.has(verifiedRole.id)) continue;
      if (member.roles.cache.has(voiceOnlyRole.id)) continue;
      if (member.roles.cache.has(readOnlyRole.id)) continue;
      if (member.roles.cache.has(mutedRole.id)) continue;
      if (member.roles.cache.has(unverifiedRole.id)) continue;
      await member.roles.add(verifiedRole);
    }

    interaction.editReply({ content: 'All users verified' });
  },
};
