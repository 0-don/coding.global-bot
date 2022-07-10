import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';

import { translate } from '../utils/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('translate text to english')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('the text to translate')
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // deferReply if it takes longer then usual
    await interaction.deferReply();

    // get lookback days from input
    const text = interaction.options.getString('text') as string;

    const translatedText = await translate(text);

    // send success message
    return interaction.editReply(translatedText);
  },
};
