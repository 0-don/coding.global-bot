export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      CLIENT_ID: string;
      GUILD_ID: string;
      MEGA_EMAIL: string;
      MEGA_PASSWORD: string;
      MEGA_DIR: string;
      DEEPL: string;
      OPEN_AI: string;
    }
  }
}
