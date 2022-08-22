import type { ChartConfiguration, ChartDataset } from 'chart.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import dayjs from 'dayjs';
import type { APIEmbed } from 'discord.js';
import type { ToptatsExampleEmbed, UserStatsExampleEmbed } from '../types';
import { codeString, placementSuffix } from './helpers';

export const statusRoles = [
  'verified',
  'voiceOnly',
  'readOnly',
  'mute',
  'unverified',
] as const;

export const EVERYONE = '@everyone';
export const VERIFIED = statusRoles[0];
export const VOICE_ONLY = statusRoles[1];
export const READ_ONLY = statusRoles[2];
export const MUTE = statusRoles[3];
export const UNVERIFIED = statusRoles[4];

export const VERIFY_CHANNEL = 'verify';
export const BOT_CHANNEL = 'bot';
export const VOICE_EVENT_CHANNEL = 'voice-events';
export const MEMBERS_COUNT_CHANNEL = 'Members:';

export const ROLE_TEMPLATE = 'role template';
export const MEMBERS_TEMPLATE = 'members count';
export const STATS_TEMPLATE = 'user stats';
export const TOP_STATS_TEMPLATE = 'top stats';
export const VERIFY_TEMPLATE = 'verify yourself';
export const BUMP_LEADERBOARDS_TEMPLATE = 'bump leaderboard';

export const RED_COLOR = 0xff0000;
export const BOT_ICON =
  'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png';

export const voiceEmbedExample: APIEmbed = {
  color: RED_COLOR,
  description: ``,
  timestamp: new Date().toISOString(),
  footer: {
    text: 'voice event',
    icon_url: BOT_ICON,
  },
};

export const roleTemplateExampleEmbed: APIEmbed = {
  color: RED_COLOR,
  title: 'Server Roles',
  description: 'Select your roles',
  fields: [],
  timestamp: new Date().toISOString(),
  footer: {
    text: ROLE_TEMPLATE,
    icon_url: BOT_ICON,
  },
};

export const topStatsExampleEmbed = ({
  mostActiveMessageUsers,
  mostActiveMessageChannels,
}: ToptatsExampleEmbed): APIEmbed => {
  const mostActiveMessageUsersSumString = codeString(
    mostActiveMessageUsers
      .reduce((a, b) => a + Number(b.count), 0)
      .toLocaleString('en') + ' messages'
  );

  const mostActiveMessageUsersString = mostActiveMessageUsers.map(
    ({ count, memberId, username }, i) =>
      `${codeString(
        placementSuffix(i + 1)
      )} <@${memberId}>: (${username}) ${codeString(
        count.toLocaleString('en') + ' messages'
      )}`
  );

  const mostActiveMessageChannelSumString = codeString(
    mostActiveMessageChannels
      .reduce((a, b) => a + Number(b.count), 0)
      .toLocaleString('en') + ' messages'
  );

  const mostActiveMessageChannelString = mostActiveMessageChannels.map(
    ({ count, channelId }, i) =>
      `${codeString(placementSuffix(i + 1))} <#${channelId}>: ${codeString(
        Number(count).toLocaleString('en') + ' messages'
      )}`
  );

  return {
    color: RED_COLOR,
    title: `⭐ Top Stats Overview`,

    description: `
Top users and channels in the past __9,999 Days__.

**Messages | Top ${mostActiveMessageUsers?.length ?? 0} - Members**
Top Member Sum: ${mostActiveMessageUsersSumString} 

${mostActiveMessageUsersString.join('\n')}

Messages | Top ${mostActiveMessageChannels?.length ?? 0} - Channels
Top Channel Sum: ${mostActiveMessageChannelSumString}

${mostActiveMessageChannelString.join('\n')}

`,
    timestamp: new Date().toISOString(),
    footer: {
      text: TOP_STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};

export const userStatsExampleEmbed = ({
  id,
  userGlobalName,
  userServerName,
  lookback,
  joinedAt,
  createdAt,
  lookbackDaysCount,
  sevenDaysCount,
  oneDayCount,
  mostActiveTextChannelId,
  mostActiveTextChannelMessageCount,
  lastMessage,
  lastVoice,
}: UserStatsExampleEmbed): APIEmbed => {
  const mostActiveTextChannelString = mostActiveTextChannelId
    ? `<#${mostActiveTextChannelId}>`
    : '';
  const mostActiveTextChannelCountString = codeString(
    mostActiveTextChannelMessageCount.toLocaleString('en') + ' messages'
  );
  const lookbackCommand = codeString('/lookback-me');

  const joinedAtUnix = dayjs(joinedAt).unix();
  const createdAtUnix = dayjs(createdAt).unix();
  const lastMessageUnix =
    lastMessage?.length > 0 && dayjs(lastMessage[0]!.createdAt).unix();
  const lastVoiceUnix =
    lastVoice?.length > 0 && dayjs(lastVoice[0]!.createdAt).unix();

  const lastMessageString = lastMessageUnix
    ? `__<t:${lastMessageUnix}:D>__ (<t:${lastMessageUnix}:R>)`
    : codeString('None');

  const lastVoiceString = lastVoiceUnix
    ? `__<t:${lastVoiceUnix}:D>__ (<t:${lastVoiceUnix}:R>)`
    : codeString('None');

  return {
    color: RED_COLOR,
    title: `👤 ${userGlobalName}'s Stats Overview`,

    description: `
${userServerName} (${userGlobalName})

User stats in the past __${lookback}__ Days. (Change with the ${lookbackCommand} command.)

**User Info**
Joined On: __<t:${joinedAtUnix}:D>__ (<t:${joinedAtUnix}:R>)
Created On: __<t:${createdAtUnix}:D>__ (<t:${createdAtUnix}:R>)
Last Message On: ${lastMessageString}
Last Voice On: ${lastVoiceString}
User ID: ${codeString(id)}

**Most Active Channels**
Messages: ${mostActiveTextChannelString} ${mostActiveTextChannelCountString}
Voice:
`,

    fields: [
      {
        name: 'Messages',
        value: `
__${lookback} Days__: ${codeString(
          `${lookbackDaysCount.toLocaleString('en')} messages`
        )} 
7 Days: ${codeString(`${sevenDaysCount.toLocaleString('en')} messages`)}
24 Hours: ${codeString(`${oneDayCount.toLocaleString('en')} messages`)}
`,

        inline: true,
      },
      {
        name: 'Voice',
        value: `
__${lookback} Days__: ${codeString(
          `${lookbackDaysCount.toLocaleString('en')} messages`
        )}
7 Days: ${codeString(`${sevenDaysCount.toLocaleString('en')} messages`)}
24 Hours: ${codeString(`${oneDayCount.toLocaleString('en')} messages`)}
`,
        inline: true,
      },
    ],

    timestamp: new Date().toISOString(),
    footer: {
      text: STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};

export const chartConfig = (data: ChartDataset[]) => {
  return {
    type: 'line',
    data: {
      datasets: [
        {
          data,
          fill: true,
          backgroundColor: '#495170',
          borderColor: '#6f86d4',
        },
      ],
    },
    options: {
      showLine: true,
      elements: {
        point: {
          radius: 0,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        yAxes: {
          ticks: { color: '#fff' },
          grid: { color: '#e6e6e6', z: 100, drawBorder: false },
          // max: data.length + Math.round((data.length / 100) * 25),
        },
        xAxes: {
          ticks: { color: '#fff' },
          grid: { display: false, drawBorder: false },
          type: 'timeseries',
          time: { unit: data.length > 360 ? 'month' : 'day' },
        },
      },
    },
  } as ChartConfiguration<'line', ChartDataset[]>;
};

export const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 400,
  backgroundColour: '#34363c',
  plugins: {
    globalVariableLegacy: ['chartjs-adapter-dayjs-3'],
  },
});
