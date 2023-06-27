import dayjs from 'dayjs';
import type {
  CacheType,
  CommandInteraction,
  GuildMember,
  User,
} from 'discord.js';

import { prisma } from '../../prisma.js';
import type { ChartDataset } from '../../types/index.js';
import { userStatsExampleEmbed } from '../constants.js';
import { getDaysArray } from '../helpers.js';

export const userStatsEmbed = async (
  interaction: CommandInteraction<CacheType>,
  user?: User | null
) => {
  const memberId = user?.id ?? interaction.member?.user.id;
  const guildId = interaction.guild?.id;

  const memberGuild = await prisma.memberGuild.findFirst({
    where: { guildId, memberId },
    include: { member: true },
  });

  const lastVoice = await prisma.guildVoiceEvents.findMany({
    where: { guildId, memberId },
    orderBy: { id: 'desc' },
    take: 1,
  });

  const lastMessage = await prisma.memberMessages.findMany({
    where: { guildId, memberId },
    orderBy: { id: 'desc' },
    take: 1,
  });

  const userServerName =
    user?.toString() ?? interaction.member?.user.toString();

  if (!memberId || !guildId || !memberGuild || !userServerName)
    return 'Something went wrong';

  const member = user?.id
    ? await interaction.guild?.members.fetch(user.id)
    : (interaction.member as GuildMember);

  const {
    lookbackDaysCount,
    oneDayCount,
    sevenDaysCount,
    mostActiveTextChannelId,
    mostActiveTextChannelMessageCount,
  } = await messagesStats(memberId, guildId, memberGuild.lookback);

  const {
    mostActiveVoice,
    lookbackVoiceSum,
    sevenDayVoiceSum,
    oneDayVoiceSum,
  } = await voiceStats(memberId, guildId, memberGuild.lookback);

  const embed = userStatsExampleEmbed({
    id: memberId,
    userGlobalName: memberGuild.member.username,
    userServerName,
    lookback: memberGuild.lookback,
    createdAt: member.user.createdAt,
    joinedAt: member.joinedAt,
    lookbackDaysCount,
    oneDayCount,
    sevenDaysCount,
    mostActiveTextChannelId,
    mostActiveTextChannelMessageCount,
    lastVoice,
    lastMessage,
    mostActiveVoice,
    lookbackVoiceSum,
    sevenDayVoiceSum,
    oneDayVoiceSum,
  });

  return embed;
};

const voiceStats = async (
  memberId: string,
  guildId: string,
  lookback: number
) => {
  const voiceStatsLookback = (await prisma.$queryRaw`
    SELECT "channelId", SUM(difference) AS sum
    FROM (
        SELECT
        "channelId",
        EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
        FROM "GuildVoiceEvents"
        WHERE "memberId" = ${memberId} 
          AND "guildId" = ${guildId}
          AND "join" > (NOW() - ${lookback + ' day'}::interval)
        ) AS t
    GROUP BY "channelId"
    ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

  const voiceStatsSevenDays = (await prisma.$queryRaw`
    SELECT "channelId", SUM(difference) AS sum
    FROM (
        SELECT
        "channelId",
        EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
        FROM "GuildVoiceEvents"
        WHERE "memberId" = ${memberId} 
          AND "guildId" = ${guildId}
          AND "join" > (NOW() - '7 days'::interval)
        ) AS t
    GROUP BY "channelId"
    ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

  const voiceStatsOneDay = (await prisma.$queryRaw`
    SELECT "channelId", SUM(difference) AS sum
    FROM (
        SELECT
        "channelId",
        EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
        FROM "GuildVoiceEvents"
        WHERE "memberId" = ${memberId} 
          AND "guildId" = ${guildId}
          AND "join" > (NOW() - '1 day'::interval)
        ) AS t
    GROUP BY "channelId"
    ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

  const mostActiveVoice = {
    ...voiceStatsLookback?.[0],
    sum: Number((Number(voiceStatsLookback?.[0]?.sum) / 60 / 60).toFixed(2)),
  };
  const lookbackVoiceSum = Number(
    (
      voiceStatsLookback.reduce((acc, curr) => acc + Number(curr.sum), 0) /
      60 /
      60
    ).toFixed(2)
  );

  const sevenDayVoiceSum = Number(
    (
      voiceStatsSevenDays.reduce(
        (acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)),
        0
      ) /
      60 /
      60
    ).toFixed(2)
  );
  const oneDayVoiceSum = Number(
    (
      voiceStatsOneDay.reduce(
        (acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)),
        0
      ) /
      60 /
      60
    ).toFixed(2)
  );

  return {
    mostActiveVoice,
    lookbackVoiceSum,
    sevenDayVoiceSum,
    oneDayVoiceSum,
  };
};

const messagesStats = async (
  memberId: string,
  guildId: string,
  lookback: number
) => {
  const memberMessagesByDate = (await prisma.memberMessages.findMany({
    where: { memberId, guildId },
    orderBy: { createdAt: 'asc' },
  })) ?? [{ createdAt: new Date() }];

  const mostActiveTextChannel = (await prisma.$queryRaw`
    SELECT "channelId", count(*) 
    FROM "MemberMessages" 
    WHERE "memberId" = ${memberId} 
    GROUP BY "channelId" 
    ORDER BY count(*) DESC 
    LIMIT 1`) as { channelId: string; count: number }[];

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
    oneDayCount,
    sevenDaysCount,
  };
};
