import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import { BOT_CHANNEL } from '../utils/constants.js';
import { topStatsEmbed } from '../utils/stats/topStatsEmbed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Get top user stats'),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    if (!interaction.guildId) return interaction.editReply('No Guild');

    if (channel.name !== BOT_CHANNEL)
      // if not bot channel, return
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    const embed = await topStatsEmbed(interaction.guildId);

    if (typeof embed === 'string') return interaction.editReply(embed);

    // return embed with chart img
    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
