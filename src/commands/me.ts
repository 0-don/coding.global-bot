import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import type {
  APIEmbed,
  CacheType,
  CommandInteraction,
  GuildMember,
  TextChannel,
} from 'discord.js';
import type { ChartDataset } from '../types';
import {
  BOT_CHANNEL,
  BOT_ICON,
  ME_TEMPLATE,
  RED_COLOR,
} from '../utils/constants';
import { codeString, getDaysArray } from '../utils/helpers';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Get your Stats'),
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

    const memberId = interaction.member?.user.id;
    const guildId = interaction.guild?.id;

    const memberGuild = await prisma.memberGuild.findFirst({
      where: { guildId, memberId },
    });

    if (!memberId || !guildId || !memberGuild)
      return interaction.editReply('Something went wrong');

    const userServerName = interaction.member?.user.toString();
    const userGlobalName = interaction.member?.user.username;

    const member = interaction.member as GuildMember;

    const memberMessagesByDate = (await prisma.memberMessages.findMany({
      where: { memberId, guildId },
      orderBy: { createdAt: 'desc' },
    })) ?? [{ createdAt: new Date() }];

    // const memberMessagesByChannel = (await prisma.memberMessages.findMany({
    //   where: { memberId, guildId },
    //   orderBy: { channelId: 'desc' },
    // })) ?? [{ createdAt: new Date() }];

    // create date array from first to today for each day
    const startEndDateArray = getDaysArray(
      memberMessagesByDate[0]?.createdAt!,
      dayjs().add(1, 'day').toDate()
    );

    const messages: ChartDataset[] = startEndDateArray.map((date) => ({
      x: dayjs(date).toDate(),
      y: memberMessagesByDate.filter(
        ({ createdAt }) => dayjs(createdAt) <= dayjs(date)
      ).length,
    }));

    let thirtyDaysCount = messages[messages.length - 1]?.y;
    let sevedDaysCount = messages[messages.length - 1]?.y;
    let oneDayCount = messages[messages.length - 1]?.y;

    // count total members for date ranges
    if (messages.length > memberGuild.lookback)
      thirtyDaysCount =
        messages[messages.length - 1]!.y -
        messages[messages.length - memberGuild.lookback]!.y;
    if (messages.length > 8)
      sevedDaysCount =
        messages[messages.length - 1]!.y - messages[messages.length - 7]!.y;
    if (messages.length > 3)
      oneDayCount =
        messages[messages.length - 1]!.y - messages[messages.length - 2]!.y;

    // create chart embed
    const embed: APIEmbed = {
      color: RED_COLOR,
      title: `👤 ${userGlobalName}'s Stats Overview`,

      description: `
      ${userServerName} (${userGlobalName})

      User stats in the past __${
        memberGuild.lookback
      }__ Days. (Change with the ${codeString('/lookback-me')} command.)

      **User Info**
      Joined On: __<t:${dayjs(member?.joinedAt).unix()}:D>__ (<t:${dayjs(
        member?.joinedAt
      ).unix()}:R>)
      Created On: __<t:${dayjs(member?.user.createdAt).unix()}:D>__ (<t:${dayjs(
        member?.user.createdAt
      ).unix()}:R>)
      User ID: ${codeString(member?.user.id)}

      **Most Active Channels**
      Message: ${codeString(memberMessagesByDate.length.toLocaleString('en'))}
      Voice:
      `,

      fields: [
        {
          name: 'Messages',
          value: `__${memberGuild.lookback} Days__: ${codeString(
            `${thirtyDaysCount} messages`
          )}
          7 Days: ${codeString(`${sevedDaysCount} messages`)}
          24 Hours: ${codeString(`${oneDayCount} messages`)}`,
          inline: true,
        },
        {
          name: 'Voice',
          value: `__${memberGuild.lookback} Days__: ${codeString(
            `${thirtyDaysCount} messages`
          )}
          7 Days: ${codeString(`${sevedDaysCount} messages`)}
          24 Hours: ${codeString(`${oneDayCount} messages`)}`,
          inline: true,
        },
      ],

      timestamp: new Date().toISOString(),
      footer: {
        text: ME_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    // return embed with chart img
    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
