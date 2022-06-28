import { error } from 'console';
import type { Interaction } from 'discord.js';

export const isCommand = async (interaction: Interaction<'raw'>) => {
  if (interaction.isCommand()) {
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
};
