import type { InferSelectModel } from "drizzle-orm";
import type { memberRole } from "@/lib/db-schema";
import type { STATUS_ROLES } from "@/shared/config/roles";

type MemberRole = InferSelectModel<typeof memberRole>;
import type {
  APIEmbed,
  Collection,
  Guild,
  GuildMember,
  Message,
  PartialGuildMember,
  Role,
  User,
} from "discord.js";

export type StatusRoles = (typeof STATUS_ROLES)[number];

export type CommandResult = {
  success: boolean;
  error?: string;
};

export type EmbedResult = { embed: APIEmbed } | { error: string };

export type MessageResult = { message: string } | { error: string };

export type TextResult = { text: string } | { error: string };

export type MembersCommandResult =
  | {
      embed: APIEmbed;
      attachment: { attachment: Buffer; name: string };
    }
  | { error: string };

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

// AI Service types
export interface AiChatResponse {
  text: string;
  gifUrl: string | null;
}

export interface MessageContext {
  context: string;
  images: string[];
}

export interface ReplyContext {
  replyContext: string;
  repliedImages: string[];
}

// Embed types
export interface UserJailedEmbedParams {
  memberId: string;
  displayName: string;
  username: string;
  reason?: string;
}

// Service types
export interface DeleteUserMessagesParams {
  guild: Guild;
  user: User | null;
  memberId: string;
  jail: string | number | boolean;
  reason?: string;
}

// Roles service types
export type UpdateDbRolesArgs = {
  oldRoles: Role[];
  newRoles: Role[];
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember | PartialGuildMember;
  guildRoles: Collection<string, Role>;
  memberDbRoles: MemberRole[];
};

export interface HandleHelperReactionParams {
  threadId: string;
  threadOwnerId: string | null;
  helperId: string;
  thankerUserId: string;
  guildId: string;
  message: Message;
}

// Spam service types
export interface UserSpamState {
  count: number;
  lastContent: string;
  lastAttachmentHashes: string[];
  recentChannels: Array<{ channelId: string; timestamp: number }>;
}

export interface SpamDetectionContext {
  accountAge: number;
  memberAge: number | null;
  channelName: string;
  username: string;
  displayName: string;
  hasCustomAvatar: boolean;
  hasBanner: boolean;
  userFlags: string[];
  isSystemAccount: boolean;
  roles: string[];
  messageLength: number;
  hasLinks: boolean;
  hasMentions: boolean;
  imageCount: number;
  messageContent: string;
}

export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}
