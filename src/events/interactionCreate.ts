import type { Interaction } from 'discord.js';
import { isCommand } from '../utils/interractionCreate/isCommand';
import { isModalSubmit } from '../utils/interractionCreate/isModalSumbit';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction<'raw'>) {
    // check if the interaction is a modal submit
    await isModalSubmit(interaction);
    // check if the interaction is a command
    await isCommand(interaction);
  },
};
