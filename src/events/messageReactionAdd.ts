import type { Event } from '../types/index.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction.js';
import { verifyReaction } from '../utils/roles/verifyReaction.js';

export default {
  name: 'messageReactionAdd',
  once: false,
  async execute(reaction, user) {
    // fetch reaction status and roles
    await reaction.fetch();

    // add verify role on like reaction in verify template
    await verifyReaction(reaction, user);

    // add role if not exist when clicked on role template embed
    return await switchRoleFromTemplate(reaction, user, 'add');
  },
} as Event<'messageReactionAdd'>;
