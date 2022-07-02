import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-user-messages')
    .setDescription('')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // respond with either error or link
    interaction.reply({ content: 'wtf' });
  },
};
