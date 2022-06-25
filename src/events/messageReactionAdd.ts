import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction';

export default {
  name: 'messageReactionAdd',
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    await reaction.fetch();
    switchRoleFromTemplate(reaction, user, 'add');
  },
};
