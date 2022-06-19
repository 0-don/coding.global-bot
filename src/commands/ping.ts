import { SlashCommandBuilder } from '@discordjs/builders';
import type { Message } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction: Message) {
    await interaction.reply('Pong!!');
  },
};
