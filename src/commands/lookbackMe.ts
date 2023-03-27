import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';
import { prisma } from '../prisma.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lookback-me')
    .setDescription('Change lookback date range for yourself')
    .addIntegerOption((option) =>
      option
        .setName('lookback')
        .setDescription('Set lookback days range')
        .setMinValue(3)
        .setMaxValue(9999)
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get lookback days from input
    const lookback = interaction.options.get('lookback')?.value as number;

    // get guild data
    const guildId = interaction.guild?.id;
    const memberId = interaction.member?.user.id;

    if (!guildId || !memberId)
      return await interaction.reply('Please use this command in a server');

    // create or update guild
    await prisma.memberGuild.upsert({
      where: { member_guild: { guildId, memberId } },
      create: { guildId, lookback, memberId, status: true },
      update: { guildId, lookback, memberId, status: true },
    });

    // send success message
    return await interaction.reply(
      `Lookback set to ${lookback} days for ${interaction.member?.user.username}`
    );
  },
};
