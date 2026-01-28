// Channel configurations parsed from environment variables
export const GENERAL_CHANNELS =
  process.env.GENERAL_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const BOT_CHANNELS =
  process.env.BOT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const VOICE_EVENT_CHANNELS =
  process.env.VOICE_EVENT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const JOIN_EVENT_CHANNELS =
  process.env.JOIN_EVENT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const MEMBERS_COUNT_CHANNELS =
  process.env.MEMBERS_COUNT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
