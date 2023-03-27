import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';

import { PermissionFlagsBits } from 'discord-api-types/v9';
import { prisma } from '../prisma.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lookback-members')
    .setDescription('Change lookback date range for guild')
    .addIntegerOption((option) =>
      option
        .setName('lookback')
        .setDescription('Set lookback days range')
        .setMinValue(3)
        .setMaxValue(9999)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get lookback days from input
    const lookback = interaction.options.get('lookback')?.value as number;

    // get guild data
    const guildId = interaction.guild?.id;
    const guildName = interaction.guild?.name;

    if (!guildId || !guildName)
      return await interaction.reply('Please use this command in a server');

    // create or update guild
    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName, lookback },
      update: { guildName, lookback },
    });

    // send success message
    return await interaction.reply(
      `Lookback set to ${lookback} days for ${guildName}`
    );
  },
};
