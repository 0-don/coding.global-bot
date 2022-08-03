import type { Event } from '../types';
import { switchRoleFromTemplate } from '../utils/roles/roleTemplateReaction';

export default {
  name: 'messageReactionRemove',
  once: false,
  async execute(reaction, user) {
    // remove role if exist when clicked on role template embed
    await switchRoleFromTemplate(reaction, user, 'remove');
  },
} as Event<'messageReactionRemove'>;
