import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Interaction } from 'discord.js';

export const isModalSubmit = async (interaction: Interaction<'raw'>) => {
  if (interaction.isModalSubmit()) {
    // verification modal proccess
    if (interaction.customId === 'verify') {
      const questionInput = interaction.fields
        .getTextInputValue('questionInput')
        .toLocaleLowerCase();
      const id = interaction.fields.getTextInputValue('id');

      const fileName = `${id}.txt`;
      const filePath = path.join(path.resolve(), fileName);
      const answers = fs.readFileSync(filePath, 'utf8').split('\n');
      fs.unlinkSync(filePath);

      // hash the answer and compare it to the hash in the file
      const questionInputMD5 = crypto
        .createHash('md5')
        .update(questionInput)
        .digest('hex');
      const correct = answers.some((answer) =>
        answer.includes(questionInputMD5)
      );

      if (correct) {
        await interaction.reply({
          content: 'Your submission was recieved successfully!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'Your submission was not successfull, please try again!',
          ephemeral: true,
        });
      }
    }
  }
};
