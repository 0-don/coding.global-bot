import type { ModelMessage } from "ai";

export const MAX_MESSAGES_PER_CHANNEL = 20;

const channelMessages = new Map<string, ModelMessage[]>();

export function getChannelHistory(channelId: string): ModelMessage[] {
  return channelMessages.get(channelId) || [];
}

export function addToChannelHistory(
  channelId: string,
  message: ModelMessage,
): void {
  const messages = getChannelHistory(channelId);
  messages.push(message);

  if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
    messages.splice(0, messages.length - MAX_MESSAGES_PER_CHANNEL);
  }

  channelMessages.set(channelId, messages);
}

export function clearChannelHistory(channelId: string): void {
  channelMessages.delete(channelId);
}
