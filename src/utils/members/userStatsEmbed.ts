import { MemberGuild, PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import type {
  CacheType,
  CommandInteraction,
  GuildMember,
  User,
} from 'discord.js';
import type { ChartDataset } from '../../types';
import { userStatsExampleEmbed } from '../constants';
import { getDaysArray } from '../helpers';

const prisma = new PrismaClient();

export const userStatsEmbed = async (
  interaction: CommandInteraction<CacheType>,
  user?: User | null
) => {
  const memberId = user?.id ?? interaction.member?.user.id;
  const guildId = interaction.guild?.id;

  const memberGuild = (await prisma.memberGuild.findFirst({
    where: { guildId, memberId: interaction.user.id },
  })) as MemberGuild;

  const userServerName =
    user?.toString() ?? interaction.member?.user.toString();
  const userGlobalName = user?.username ?? interaction.member?.user.username;

  if (
    !memberId ||
    !guildId ||
    !memberGuild ||
    !userServerName ||
    !userGlobalName
  )
    return 'Something went wrong';

  const member = interaction.member as GuildMember;

  const {
    lookbackDaysCount,
    memberMessagesByDate,
    oneDayCount,
    sevenDaysCount,
    mostActiveTextChannelId,
    mostActiveTextChannelMessageCount,
  } = await messagesStats(memberId, guildId, memberGuild.lookback);

  const embed = userStatsExampleEmbed({
    id: memberId,
    userGlobalName,
    userServerName,
    lookback: memberGuild.lookback,
    createdAt: member.user.createdAt,
    joinedAt: member.joinedAt,
    lookbackDaysCount,
    memberMessagesByDate,
    oneDayCount,
    sevenDaysCount,
    mostActiveTextChannelId,
    mostActiveTextChannelMessageCount,
  });

  return embed;
};

const messagesStats = async (
  memberId: string,
  guildId: string,
  lookback: number
) => {
  const memberMessagesByDate = (await prisma.memberMessages.findMany({
    where: { memberId, guildId },
    orderBy: { createdAt: 'desc' },
  })) ?? [{ createdAt: new Date() }];

  const mostActiveTextChannel = await prisma.$queryRaw<
    [{ channelId: string; count: number }]
  >`SELECT "channelId", count(*) FROM "MemberMessages" WHERE "memberId" = ${memberId} GROUP BY "channelId" ORDER BY count(*) DESC LIMIT 1`;

  const mostActiveTextChannelId = mostActiveTextChannel?.[0]?.channelId;
  const mostActiveTextChannelMessageCount = Number(
    mostActiveTextChannel?.[0]?.count ?? 0
  );

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

  let lookbackDaysCount = messages[messages.length - 1]?.y ?? 0;
  let sevenDaysCount = messages[messages.length - 1]?.y ?? 0;
  let oneDayCount = messages[messages.length - 1]?.y ?? 0;

  // count total members for date ranges
  if (messages.length > lookback)
    lookbackDaysCount =
      messages[messages.length - 1]!.y -
      messages[messages.length - lookback]!.y;
  if (messages.length > 8)
    sevenDaysCount =
      messages[messages.length - 1]!.y - messages[messages.length - 7]!.y;
  if (messages.length > 3)
    oneDayCount =
      messages[messages.length - 1]!.y - messages[messages.length - 2]!.y;
  return {
    mostActiveTextChannelId,
    mostActiveTextChannelMessageCount,
    lookbackDaysCount,
    memberMessagesByDate,
    oneDayCount,
    sevenDaysCount,
  };
};
