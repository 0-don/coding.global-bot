import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, Message } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction: CommandInteraction<CacheType>) {
    await interaction.reply('Pong!!');
  },
};
