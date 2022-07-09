import { SlashCommandBuilder } from '@discordjs/builders';
import type {
  CacheType,
  CommandInteraction,
  MessageEmbedOptions,
  TextChannel,
} from 'discord.js';
import {
  BOT_CHANNEL,
  BOT_ICON,
  MEMBERS_TEMPLATE,
  RED_COLOR,
} from '../utils/constants';
import { guildMemberCountChart } from '../utils/guilds/guildMemberCountChart';

export default {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Memberflow and count of the past'),
  async execute(interaction: CommandInteraction<CacheType>) {
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    await interaction.deferReply();

    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    const { imgPath } = await guildMemberCountChart(
      interaction.guild!,
      interaction.client
    );

    const embed: MessageEmbedOptions = {
      color: RED_COLOR,
      title: `${interaction.guild?.name}'s 👤Member Count Overview`,
      description: `Look who has bumped the most times`,
      timestamp: new Date(),
      footer: {
        text: MEMBERS_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    return interaction.editReply({ embeds: [embed], files: [imgPath] });
  },
};
