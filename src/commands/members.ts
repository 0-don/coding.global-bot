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
import { codeString } from '../utils/helpers';

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
    // if(!chart.fileName ||!chart.imgPath ||!chart.lookback || !chart.oneDayCount || !chart.sevedDaysCount|| !chart.thirtyDaysCount)

    const attachment = new MessageAttachment(chart.imgPath!, chart.fileName);

    const count = interaction.guild.members.cache.size;
    const memberCount = interaction.guild.members.cache.filter(
      (member) => !member.user.bot
    ).size;
    const botCount = count - memberCount;

    // create chart embed
    const embed: MessageEmbedOptions = {
      color: RED_COLOR,
      title: `🛡️ ${interaction.guild?.name}'s Member Count Overview`,
      // prettier-ignore
      description: 
      `
      Memberflow and count in the past ${chart.lookback} Days. (Change with the ${codeString("/lookback")} command.)

      **Members**
      Users: ${codeString(memberCount)}
      Bots: ${codeString(botCount)}

      **Memberflow 30 Days**
      Change: \`${(chart.thirtyDaysCount!<0?'':'+') + chart.thirtyDaysCount} members\`
      **Memberflow 7 Days**
      Change: \`${(chart.sevedDaysCount!<0?'':'+') + chart.sevedDaysCount} members\`
      **Memberflow 24 Hours**
      Change: \`${(chart.oneDayCount!<0?'':'+') + chart.oneDayCount} members\`
      `,
      // prettier-ignore
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
