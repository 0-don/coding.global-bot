import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction } from 'discord.js';
import { gpt } from '../chatgpt.js';
import { prisma } from '../prisma.js';

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

    const userId = interaction.user.id;

    const memberGuild = await prisma.memberGuild.findFirst({
      where: { memberId: userId },
    });

    if (!memberGuild) return interaction.editReply('User not Found');

    let res = await gpt.sendMessage(
      interaction.options.get('text')?.value as string,
      { parentMessageId: memberGuild.gptId || undefined }
    );

    // save gptId
    await prisma.memberGuild.update({
      where: { id: memberGuild.id },
      data: { gptId: res.id },
    });

    // send success message
    return interaction.editReply({
      content: res.text,
      allowedMentions: { users: [] },
    });
  },
};
