import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, Message } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Replies with your input!')
    .addStringOption((option) =>
      option
        .setName('input')
        .setDescription('The input to echo back')
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const string = interaction.options.getString('input');

    await interaction.reply(string!);
  },
};
