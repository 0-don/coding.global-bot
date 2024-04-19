import crypto from 'crypto';
import { writeFileSync } from 'fs';
import { Tiktoken, getEncoding } from 'js-tiktoken';
import Keyv from 'keyv';
import OpenAI from 'openai';
import { 
  ChatCompletionMessageParam, 
  ChatCompletionUserMessageParam, 
  ChatCompletionAssistantMessageParam, 
  ChatCompletionSystemMessageParam 
} from 'openai/resources/chat/completions.mjs';
import { Stream } from 'openai/streaming.mjs';
import QuickLRU from 'quick-lru';

class ChatGPTAPI {
  private model: string = 'gpt-4-1106-preview';
  private store: Keyv<ChatMessage>;
  private openai: OpenAI;
  private maxModelTokens: number = 8000;
  private maxResponseTokens: number = 1000;
  private tokenizer: Tiktoken = getEncoding('cl100k_base');

  constructor(opts: { apiKey: string }) {
    this.openai = new OpenAI({ apiKey: opts.apiKey });
    this.store = new Keyv<ChatMessage>({
      store: new QuickLRU<string, ChatMessage>({ maxSize: 10000 }),
    });
  }

  public async *sendMessage(opts: SendMessageOptions): AsyncGenerator<ChatMessage, void, unknown> {
    this.model = opts.fileLink ? 'gpt-4-vision-preview' : 'gpt-4-turbo';
    const latestQuestion = this.createMessage({ role: 'user', text: opts.text }, opts);
    const newMessage = this.createMessage({ role: 'assistant', text: '', parentMessageId: latestQuestion.id }, opts);

    const { messages, maxTokens } = await this.buildMessages(opts.text, opts);

    for await (const chunk of this.streamCompletion(messages, maxTokens)) {
      this.updateResultFromStream(chunk, newMessage);
      if (newMessage.choice?.finish_reason !== 'stop') {
        yield newMessage;
        this.storeMessages(latestQuestion, newMessage);
      }
    }
  }

  private createMessage(
    config: { role: 'user' | 'assistant'; text: string; parentMessageId?: string },
    opts: SendMessageOptions
  ): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: config.role,
      text: config.text,
      parentMessageId: config.parentMessageId ?? opts.parentMessageId,
      fileLink: opts.fileLink
    };
  }

  private async buildMessages(
    text: string,
    opts: SendMessageOptions
  ): Promise<{ messages: ChatCompletionMessageParam[]; maxTokens: number }> {
    let messages: ChatCompletionMessageParam[] = [];
    const maxNumTokens = this.maxModelTokens - this.maxResponseTokens;
    let numTokens = 0;
    let role: 'user' | 'assistant' = 'user';

    do {
      const userMessages: ChatCompletionMessageParam = {
        role,
        content: role === 'user' ? text : ''
      };
      if (opts.fileLink && role === 'user' && this.model === 'gpt-4-vision-preview') {
        userMessages.content = { type: 'image_url', image_url: { url: opts.fileLink } };
      }
      messages.unshift(userMessages);
      const prompt = this.formatPrompt(messages);
      numTokens = this.getTokenCount(prompt);

      if (numTokens > maxNumTokens || !opts.parentMessageId) break;

      const parentMessage = await this.store.get(opts.parentMessageId);
      if (!parentMessage) break;

      text = parentMessage.text;
      role = parentMessage.role;
      opts.parentMessageId = parentMessage.parentMessageId;
    } while (true);

    if (opts.systemMessage) {
      messages.unshift({ role: 'system', content: opts.systemMessage });
    }

    const maxTokens = Math.min(this.maxModelTokens - numTokens, this.maxResponseTokens);

    writeFileSync('messages.json', JSON.stringify(messages, null, 2));
    return { messages, maxTokens };
  }

  private formatPrompt(messages: ChatCompletionMessageParam[]): string {
    return messages.map(message => {
      switch (message.role) {
        case 'system':
          return `Instructions:\n${message.content}`;
        case 'assistant':
          return `Assistant:\n${message.content}`;
        case 'user':
          return `User:\n${message.content.type === 'text' ? message.content.text : message.content.image_url.url}`;
        default:
          return '';
      }
    }).join('\n\n');
  }

  private async streamCompletion(messages: ChatCompletionMessageParam[], maxTokens: number): Promise<Stream<ChatCompletionChunk>> {
    return this.openai.chat.completions.create({ model: this.model, messages, max_tokens: maxTokens, stream: true });
  }

  private updateResultFromStream(chunk: ChatCompletionChunk, result: ChatMessage): void {
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason !== 'stop') {
      result.text += choice.delta.content;
      result.detail = chunk;
      result.choice = choice;
    }
  }

  private storeMessages(latestQuestion: ChatMessage, result: ChatMessage): void {
    this.store.set(latestQuestion.id, latestQuestion);
    this.store.set(result.id, result);
  }

  private getTokenCount(text: string): number {
    return this.tokenizer.encode(text.replace(/<\|endoftext\|>/g, '')).length;
  }
}

export type ChatMessage = {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  choice?: OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0];
  detail?: OpenAI.Chat.Completions.ChatCompletionChunk;
  parentMessageId?: string;
  fileLink?: string;
};

export type SendMessageOptions = {
  text: string;
  parentMessageId?: string | null;
  systemMessage?: string;
  fileLink?: string;
};

const gpt = new ChatGPTAPI({ apiKey: process.env.OPEN_AI });
if (process.env.NODE_ENV !== 'production') global['api'] = gpt;
