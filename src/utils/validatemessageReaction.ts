import type { MessageReaction, PartialMessageReaction } from 'discord.js';

export const validateMessageReaction = async (
  reaction: MessageReaction | PartialMessageReaction
) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
      return true;
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      // Return as `reaction.message.author` may be undefined/null
      return false;
    }
  }
  return true;
};
