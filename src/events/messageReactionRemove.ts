import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction';

export default {
  name: 'messageReactionRemove',
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    // remove role if exist when clicked on role template embed
    await switchRoleFromTemplate(reaction, user, 'remove');
  },
};
