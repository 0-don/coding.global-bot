import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('verify yourself with a catpcha question'),
  async execute(interaction: CommandInteraction<CacheType>) {
    interaction.channel;
  },
};
