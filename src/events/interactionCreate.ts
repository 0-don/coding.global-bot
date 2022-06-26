import { error } from 'console';
import type { Interaction } from 'discord.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction<'raw'>) {
    // check if the interaction is a select menu
    if (interaction.isSelectMenu()) {
      if (interaction?.customId === 'select') {
        await interaction.deferUpdate();
        return;
      }
      // check if the interaction is a command interaction
    } else if (interaction.isCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        error(err);
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    }
  },
};
