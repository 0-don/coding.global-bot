import type { GuildVoiceEvents, MemberMessages } from "@prisma/client";
import { Message } from "discord.js";
import type { STATUS_ROLES } from "../lib/constants";

export type StatusRoles = (typeof STATUS_ROLES)[number];

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

export type UserStatsExampleEmbed = {
  id: string;
  helpReceivedCount: number;
  helpCount: number;
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
    },
  ];
  mostHelpfulUsers: [{ memberId: string; count: number; username: string }];
  mostActiveMessageChannels: [
    {
      channelId: string;
      count: number;
    },
  ];
  mostActiveVoiceUsers: { memberId: string; username: string; sum: number }[];
  mostActiveVoiceChannels: { channelId: string; sum: number }[];
  lookback: number;
};

export interface UserState {
  count: number;
  lastMessage: Message | null;
  same?: boolean;
  recentLinks: Map<string, Set<string>>;
}

export type Commands =
  | "troll-move-user"
  | "create-verify-embed"
  | "delete-member-db"
  | "delete-messages"
  | "delete-user-messages"
  | "log-command-history"
  | "log-deleted-messages-history"
  | "lookback-members"
  | "verify-all-users"
  | "lookback-me"
  | "me"
  | "members"
  | "top"
  | "translate"
  | "user"
  | "ask";
