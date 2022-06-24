import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction';
import { validateMessageReaction } from '../utils/validatemessageReaction';

export default {
  name: 'messageReactionRemove',
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    if (!validateMessageReaction(reaction)) return;
    switchRoleFromTemplate(reaction, user, 'remove');
  },
};
