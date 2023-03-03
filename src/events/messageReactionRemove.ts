import type { Event } from '../types/index.js';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction.js';

export default {
  name: 'messageReactionRemove',
  once: false,
  async execute(reaction, user) {
    // remove role if exist when clicked on role template embed
    await switchRoleFromTemplate(reaction, user, 'remove');
  },
} as Event<'messageReactionRemove'>;
