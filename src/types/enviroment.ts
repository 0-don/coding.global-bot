export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      DEEPL: string;
      OPEN_AI: string;
      SHOULD_USER_LEVEL_UP: string;
      HELPER_ROLES: string;
      STATUS_ROLES: string;
      MEMBER_ROLES: string;
      LEVEL_ROLES: string;
      GENERAL_CHANNELS: string;
      BOT_CHANNELS: string;
      VERIFY_CHANNELS: string;
      VOICE_EVENT_CHANNELS: string;
      JOIN_EVENT_CHANNELS: string;
      MEMBERS_COUNT_CHANNELS: string;
      IS_CONSTRAINED_TO_BOT_CHANNEL: string;
      SHOULD_LOG_VOICE_EVENTS: string;
      BOT_ICON: string;
      SHOULD_COUNT_MEMBERS: string;
    }
  }
}
