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

      // the user maybe change the id modal field
      let answers: string[] = [];
      try {
        answers = fs.readFileSync(filePath, 'utf8').split('\n');
      } catch (_) {
        return await interaction.reply({
          content: 'dont change the id field,please try again.',
          ephemeral: true,
        });
      }

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
        interaction.reply({
          content: 'Your submission was recieved successfully!',
          ephemeral: true,
        });
        await interaction.channel?.guild.fetch();
        const verifiedRole = interaction.channel?.guild.roles.cache.find(
          (role) => role.name === 'verified'
        );
        const unverifiedRole = interaction.channel?.guild.roles.cache.find(
          (role) => role.name === 'unverified'
        );
        const member = interaction.channel?.guild.members.cache.get(
          interaction.user.id
        );

        if (!verifiedRole || !member || !unverifiedRole) {
          return interaction.reply({
            content: 'Something went wrong, contact the admins',
            ephemeral: true,
          });
        }

        member.roles.remove(unverifiedRole);
        member.roles.add(verifiedRole);
      } else {
        await interaction.reply({
          content: 'Your submission was not successfull, please try again!',
          ephemeral: true,
        });
      }
    }
  }
};
