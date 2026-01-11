// Core/Required environment variables
interface CoreBotEnvironment {
  TOKEN: string;
  // Database config (from your docker-compose.yml)
  DATABASE_URL?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_HOST?: string;
  POSTGRES_DB?: string;
}

// Feature-specific environment variables
interface FeatureBotEnvironment {
  // AI Features
  TENOR_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  DEEPL: string;

  // Role System Features
  HELPER_ROLES: string;
  STATUS_ROLES: string;
  MEMBER_ROLES: string;
  LEVEL_ROLES: string;

  // Channel Configuration Features
  GENERAL_CHANNELS: string;
  BOT_CHANNELS: string;
  VOICE_EVENT_CHANNELS: string;
  JOIN_EVENT_CHANNELS: string;
  MEMBERS_COUNT_CHANNELS: string;

  // Behavior Control Features
  IS_CONSTRAINED_TO_BOT_CHANNEL: string;
  SHOULD_LOG_VOICE_EVENTS: string;
  SHOULD_COUNT_MEMBERS: string;
  SHOULD_USER_LEVEL_UP: string;

  // Appearance Features
  BOT_ICON: string;
}

// Combined environment interface
interface BotEnvironment extends CoreBotEnvironment, FeatureBotEnvironment {}

declare namespace NodeJS {
  export interface ProcessEnv extends BotEnvironment {}
}
