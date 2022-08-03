import type { Event } from '../types';
import { isCommand } from '../utils/interractionCreate/isCommand';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    // check if the interaction is a command
    await isCommand(interaction);
  },
} as Event<'interactionCreate'>;
