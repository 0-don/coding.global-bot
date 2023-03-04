import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';
import { askChatGPT } from '../utils/chatgpt/askChatGPT.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('talk to ai')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('ask ai a question')
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // deferReply if it takes longer then usual
    await interaction.deferReply();

    const user = interaction.user;

    const text = interaction.options.get('text')?.value as string;

    const content = await askChatGPT({ interaction, user, text });

    if (!content) return interaction.editReply('User not Found');
    // send success message

    return (
      content.length < 2000 &&
      (await interaction.editReply({
        content: content,
        allowedMentions: { users: [] },
      }))
    );
  },
};
