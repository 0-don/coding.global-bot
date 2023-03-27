import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import { BOT_CHANNEL } from '../utils/constants.js';
import { userStatsEmbed } from '../utils/stats/userStatsEmbed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Get your stats'),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get text channel

    // deferReply if it takes longer then usual
    interaction.deferReply();

    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    const embed = await userStatsEmbed(interaction);

    if (typeof embed === 'string') return interaction.editReply(embed);

    // return embed with chart img
    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
