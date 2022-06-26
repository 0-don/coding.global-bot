import { SlashCommandBuilder } from '@discordjs/builders';
import {
  CacheType,
  CommandInteraction,
  MessageActionRow,
  Modal,
  TextInputComponent,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('verify yourself with a catpcha question'),
  async execute(interaction: CommandInteraction<CacheType>) {
    const modal = new Modal().setCustomId('myModal').setTitle('My Modal');
    // Add components to modal
    // Create the text input components
    const favoriteColorInput = new TextInputComponent()
      .setCustomId('favoriteColorInput')
      // The label is the prompt the user sees for this input
      .setLabel("What's your favorite color?")
      // Short means only a single line of text
      .setStyle('SHORT');
    const hobbiesInput = new TextInputComponent()
      .setCustomId('hobbiesInput')
      .setLabel("What's some of your favorite hobbies?")
      // Paragraph means multiple lines of text.
      .setStyle('PARAGRAPH');
    // An action row only holds one text input,
    // so you need one action row per text input.
    const firstActionRow = new MessageActionRow().addComponents(
      // @ts-ignore
      favoriteColorInput
    );
    // @ts-ignore
    const secondActionRow = new MessageActionRow().addComponents(hobbiesInput);
    // Add inputs to the modal
    // @ts-ignore
    modal.addComponents(firstActionRow, secondActionRow);
    // Show the modal to the user
    await interaction.showModal(modal);
  },
};
