export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      DEEPL: string;
      OPEN_AI: string;
      HELPER_ROLES: string;
      STATUS_ROLES: string;
      MEMBER_ROLES: string;
      GENERAL_CHANNEL: string;
      BOT_CHANNEL: string;
      VERIFY_CHANNEL: string;
      VOICE_EVENT_CHANNEL: string;
      JOIN_EVENTS_CHANNEL: string;
      MEMBERS_COUNT_CHANNEL: string;
      IS_CONSTRAINED_TO_BOT_CHANNEL: string;
      SHOULD_LOG_VOICE_EVENTS: string;
      BOT_ICON: string;
    }
  }
}
