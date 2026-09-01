import type { GrantedIntents } from "./intents";

// Feature flags parsed from environment variables

export const IS_CONSTRAINED_TO_BOT_CHANNEL =
  process.env.IS_CONSTRAINED_TO_BOT_CHANNEL?.trim() === "true";

export const SHOULD_LOG_VOICE_EVENTS =
  process.env.SHOULD_LOG_VOICE_EVENTS?.trim() === "true";

export const SHOULD_COUNT_MEMBERS =
  process.env.SHOULD_COUNT_MEMBERS?.trim() === "true";

export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP?.trim() === "true";

// Which privileged intents Discord actually granted, resolved at startup by
// intents.ts. Defaults to granted so a failed lookup never silently disables
// moderation; setIntentState overwrites it before the client connects.
let intentState: GrantedIntents = {
  guildMembers: true,
  guildPresences: true,
  messageContent: true,
};

export function setIntentState(granted: GrantedIntents): void {
  intentState = granted;
}

export const canReadMessageContent = () => intentState.messageContent;

export const canTrackMembers = () => intentState.guildMembers;

export const canReadPresence = () => intentState.guildPresences;
