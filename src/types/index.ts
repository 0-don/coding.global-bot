import type { APIEmbed } from "discord.js";
import type { STATUS_ROLES } from "@/shared/config/roles";

export type StatusRoles = (typeof STATUS_ROLES)[number];

// Shared handler result types
export type CommandResult = {
  success: boolean;
  error?: string;
};

export type EmbedResult = { embed: APIEmbed } | { error: string };

export type MessageResult = { message: string } | { error: string };

export type TextResult = { text: string } | { error: string };

export type ChartDataPoint = { x: Date; y: number };

export type GuildMemberCountChart = {
  buffer?: Buffer;
  fileName?: string;
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
  lastVoiceAt: string | null;
  lastMessageAt: string | null;
  mostActiveVoice: {
    channelId: string;
    sum: number;
  };
  lookbackVoiceSum: number;
  sevenDayVoiceSum: number;
  oneDayVoiceSum: number;
};

export type ToptatsExampleEmbed = {
  mostActiveMessageUsers: {
    memberId: string;
    count: number;
    username: string;
  }[];
  mostHelpfulUsers: { memberId: string; count: number; username: string }[];
  mostActiveMessageChannels: {
    channelId: string;
    count: number;
  }[];
  mostActiveVoiceUsers: { memberId: string; username: string; sum: number }[];
  mostActiveVoiceChannels: { channelId: string; sum: number }[];
  lookback: number;
};

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
