import type { Event } from '../types/index.js';
import { isCommand } from '../utils/interractionCreate/isCommand.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    // check if the interaction is a command
    await isCommand(interaction);
  },
} as Event<'interactionCreate'>;
