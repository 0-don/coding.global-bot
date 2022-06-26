import type { Interaction } from 'discord.js';

export const isModalSubmit = async (interaction: Interaction<'raw'>) => {
  if (interaction.isModalSubmit()) {
    // verification modal proccess
    if (interaction.customId === 'myModal') {
      await interaction.reply({
        content: 'Your submission was recieved successfully!',
      });
      const favoriteColor =
        interaction.fields.getTextInputValue('favoriteColorInput');
      const hobbies = interaction.fields.getTextInputValue('hobbiesInput');
    }
    // check if the interaction is a command interaction
  }
};
