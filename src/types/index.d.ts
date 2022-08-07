import type { MessageEmbedOptions } from 'discord.js';
import { statusRoles } from '../utils/constants';
import { ClientEvents } from 'discord.js';
import type { Interface } from 'readline';

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
  roleTemplateEmbed: MessageEmbedOptions | undefined;
};

export type QuestionRequest = {
  q: string;
  a: string[];
};

export type StatusRoles = typeof statusRoles[number];

export type ChartDataset = { x: dayjs.Dayjs; y: number };

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
  memberMessagesByDate: MemberMessages[];
  lookbackDaysCount: number;
  sevenDaysCount: number;
  oneDayCount: number;
  mostActiveTextChannelId: string | undefined;
  mostActiveTextChannelMessageCount: number;
};

export type ToptatsExampleEmbed = {
  mostActiveMessageUsers: { memberId: string; count: number }[];
  mostActiveMessageChannels: {
    channelId: string;
    count: number;
  }[];
};
