import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import { BOT_CHANNEL } from '../utils/constants.js';
import { userStatsEmbed } from '../utils/stats/userStatsEmbed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Get stats from specific user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Select user which stats should be shown')
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const user = interaction.options.getUser('user');

    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    const embed = await userStatsEmbed(interaction, user);

    if (typeof embed === 'string') return interaction.editReply(embed);

    // return embed
    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
