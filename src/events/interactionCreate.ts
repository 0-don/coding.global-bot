import type { Interaction } from 'discord.js';
import { isCommand } from '../utils/interractionCreate/isCommand';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction<'raw'>) {
    // check if the interaction is a command
    await isCommand(interaction);
  },
};
