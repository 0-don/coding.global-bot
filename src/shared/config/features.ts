// Feature flags parsed from environment variables

export const IS_CONSTRAINED_TO_BOT_CHANNEL =
  process.env.IS_CONSTRAINED_TO_BOT_CHANNEL?.trim() === "true";

export const SHOULD_LOG_VOICE_EVENTS =
  process.env.SHOULD_LOG_VOICE_EVENTS?.trim() === "true";

export const SHOULD_COUNT_MEMBERS =
  process.env.SHOULD_COUNT_MEMBERS?.trim() === "true";

export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP?.trim() === "true";
