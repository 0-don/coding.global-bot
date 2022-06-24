import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { validateMessageReaction } from '../utils/validatemessageReaction';

export default {
  name: 'messageReactionAdd',
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    if (!validateMessageReaction(reaction)) return;

    console.log(reaction.message.embeds[0]?.footer?.text);
  },
};
