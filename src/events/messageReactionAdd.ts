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
    // check if reaction is on verify message
    const verifyTemplate = reaction.message.embeds[0]?.footer?.text;
    if (verifyTemplate === 'verify yourself') return await reaction.remove();

    // add role if not exist when clicked on role template embed
    return await switchRoleFromTemplate(reaction, user, 'add');
  },
};
