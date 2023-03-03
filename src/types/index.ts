import type { GuildVoiceEvents,MemberMessages } from '@prisma/client';
import type { APIEmbed, Awaitable,ClientEvents } from 'discord.js';
import type { statusRoles } from '../utils/constants.js';
import './discord.js';
import './enviroment.js';


export type RoleTemplateReactionValues = {
  name: string;
  value: string;
  emoji: string;
};

export type RoleTemplateReactionTuple = [
  RoleTemplateReactionValues,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?
];

export type RoleTemplateReaction = {
  title: string;
  description: string;
  reactions: RoleTemplateReactionTuple;
};

export type CreateRoleTemplateEmbed = {
  error: string | undefined;
  emojis: (string | undefined)[] | undefined;
  roleTemplateEmbed: APIEmbed | undefined;
};

export type QuestionRequest = {
  q: string;
  a: string[];
};

export type StatusRoles = (typeof statusRoles)[number];

export type ChartDataset = { x: Date; y: number };

export type GuildMemberCountChart = {
  link?: string;
  fileName?: string;
  imgPath?: string;
  thirtyDaysCount?: number;
  sevedDaysCount?: number;
  oneDayCount?: number;
  lookback?: number;
  error?: string;
};

export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Awaitable<void>;
}

export type UserStatsExampleEmbed = {
  id: string;
  userGlobalName: string;
  userServerName: string;
  lookback: number;
  joinedAt: Date | null;
  createdAt: Date;
  lookbackDaysCount: number;
  sevenDaysCount: number;
  oneDayCount: number;
  mostActiveTextChannelId?: string;
  mostActiveTextChannelMessageCount: number;
  lastVoice: GuildVoiceEvents[];
  lastMessage: MemberMessages[];
  mostActiveVoice: {
    channelId: string;
    sum: number;
  };
  lookbackVoiceSum: number;
  sevenDayVoiceSum: number;
  oneDayVoiceSum: number;
};

export type ToptatsExampleEmbed = {
  mostActiveMessageUsers: [
    {
      memberId: string;
      count: number;
      username: string;
    }
  ];
  mostActiveMessageChannels: [
    {
      channelId: string;
      count: number;
    }
  ];
  mostActiveVoiceUsers: { memberId: string; username: string; sum: number }[];
  mostActiveVoiceChannels: { channelId: string; sum: number }[];
};
