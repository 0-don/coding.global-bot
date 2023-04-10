import { ChatGPTAPI } from 'chatgpt';

const globalForPrisma = global as unknown as { api: ChatGPTAPI };

export const gpt =
  globalForPrisma.api ||
  new ChatGPTAPI({
    apiKey: process.env.OPEN_AI,
    completionParams: {
      model: 'gpt-3.5-turbo',
      max_tokens: 4097,
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.api = gpt;
