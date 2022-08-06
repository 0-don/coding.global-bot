import type { ChartConfiguration, ChartDataset } from 'chart.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import dayjs from 'dayjs';
import type { APIEmbed } from 'discord.js';
import type { UserStatsExampleEmbed } from '../types';
import { codeString } from './helpers';

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
export const ME_TEMPLATE = 'my stats';
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
  mostActiveTextChannel,
}: UserStatsExampleEmbed): APIEmbed => ({
  color: RED_COLOR,
  title: `👤 ${userGlobalName}'s Stats Overview`,
  // prettier-ignore
  description: 
`
${userServerName} (${userGlobalName})

User stats in the past __${lookback}__ Days. (Change with the ${codeString('/lookback-me')} command.)

**User Info**
Joined On: __<t:${dayjs(joinedAt).unix()}:D>__ (<t:${dayjs(joinedAt).unix()}:R>)
Created On: __<t:${dayjs(createdAt).unix()}:D>__ (<t:${dayjs(createdAt).unix()}:R>)
User ID: ${codeString(id)}

**Most Active Channels**
Messages: <#${mostActiveTextChannel[0].channelId}> ${codeString(Number(mostActiveTextChannel[0].count).toLocaleString('en') + " messages")}
Voice:

`,

  fields: [
    {
      name: 'Messages',
      value: 
`__${lookback} Days__: ${codeString(`${lookbackDaysCount} messages`)}
7 Days: ${codeString(`${sevenDaysCount} messages`)}
24 Hours: ${codeString(`${oneDayCount} messages`)}
`,
      inline: true,
    },
    {
      name: 'Voice',
      value: 
`__${lookback} Days__: ${codeString(`${lookbackDaysCount} messages`)}
7 Days: ${codeString(`${sevenDaysCount} messages`)}
24 Hours: ${codeString(`${oneDayCount} messages`)}
`,
      inline: true,
    },
  ],
  // prettier-ignore
  timestamp: new Date().toISOString(),
  footer: {
    text: ME_TEMPLATE,
    icon_url: BOT_ICON,
  },
});

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
