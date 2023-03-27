import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';
import { askChatGPT } from '../utils/chatgpt/askChatGPT.js';
import { chunkedSend } from '../utils/messages/chunkedSend.js';

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
    console.log(1);
    await interaction.deferReply();
    console.log(2);
    const user = interaction.user;
    console.log(3);

    const text = interaction.options.get('text')?.value as string;
    console.log(4);

    const content = await askChatGPT({ interaction, user, text });
    console.log(5);
    if (!content) return await interaction.editReply('User not Found');
    console.log(6);
    // send success message

    return await chunkedSend({ content, interaction });
  },
};
