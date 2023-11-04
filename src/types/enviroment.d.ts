export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      DEEPL: string;
      OPEN_AI: string;
    }
  }
}
