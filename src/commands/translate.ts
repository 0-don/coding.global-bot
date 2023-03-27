import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType,CommandInteraction } from 'discord.js';

import { translate } from '../utils/helpers.js';



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
    const text = Buffer.from(
      interaction.options.get('text')?.value as string,
      'utf-8'
    ).toString();

    const translatedText = await translate(text);

    // send success message
    return await interaction.editReply({
      content: translatedText,
      allowedMentions: { users: [] },
    });
  },
};
