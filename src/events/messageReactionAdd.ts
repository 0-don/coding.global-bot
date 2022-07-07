import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction';
import { verifyReaction } from '../utils/roles/verifyReaction';

export default {
  name: 'messageReactionAdd',
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    // fetch reaction status and roles
    await reaction.fetch();

    // add verify role on like reaction in verify template
    await verifyReaction(reaction, user);

    // add role if not exist when clicked on role template embed
    return await switchRoleFromTemplate(reaction, user, 'add');
  },
};
