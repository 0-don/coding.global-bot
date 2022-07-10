import { SlashCommandBuilder } from '@discordjs/builders';
import {
  CacheType,
  CommandInteraction,
  MessageAttachment,
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
    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    // if somehow no guild, return
    if (!interaction.guild)
      return interaction.editReply('Please use this command in a server');

    // get guild member chart data from specifc guild
    const chart = await guildMemberCountChart(interaction.guild);

    // if error occured, return
    if (chart?.error) return interaction.editReply(chart.error);

    const attachment = new MessageAttachment(chart.imgPath!, chart.fileName);

    // create chart embed
    const embed: MessageEmbedOptions = {
      color: RED_COLOR,
      title: `🛡️${interaction.guild?.name}'s Member Count Overview`,
      description: `Memberflow and count in the past 9,999 Days. (Change with the s?lookback command.)`,
      timestamp: new Date(),
      image: { url: `attachment://${chart.fileName}` },
      footer: {
        text: MEMBERS_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    // return embed with chart img
    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  },
};
