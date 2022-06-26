import type { Interaction } from 'discord.js';

export const isModalSubmit = async (interaction: Interaction<'raw'>) => {
  if (interaction.isModalSubmit()) {
    // verification modal proccess
    if (interaction.customId === 'verify') {
      const questionInput =
        interaction.fields.getTextInputValue('questionInput');
      const id = interaction.fields.getField('id');

      console.log(questionInput, id);

      await interaction.reply({
        content: 'Your submission was recieved successfully!',
        ephemeral: true,
      });
    }
  }
};
