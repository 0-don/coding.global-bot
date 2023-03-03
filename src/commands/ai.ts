import { SlashCommandBuilder } from '@discordjs/builders';
import dayjs from 'dayjs';
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

    const olderThen30Min = dayjs(memberGuild.gptDate).isBefore(
      dayjs().subtract(30, 'minute')
    );

    let res = await gpt.sendMessage(
      interaction.options.get('text')?.value as string,
      {
        parentMessageId: (!olderThen30Min && memberGuild.gptId) || undefined,
        systemMessage: `You are coding.global AI, a large language model trained by OpenAI. You answer as concisely as possible for each responseIf you are generating a list, do not have too many items. Current date: ${new Date().toISOString()}\n\n`,
      }
    );

    // save gptId
    await prisma.memberGuild.update({
      where: { id: memberGuild.id },
      data: { gptId: res.id },
    });

    const content = [
      `**<@${userId}> ${interaction.user.username}'s Question:**`,
      `${'```\n'}${interaction.options.get('text')?.value as string}${'```'}`,
      res.text,
    ];

    // send success message
    return interaction.editReply({
      content: content.join('\n'),
      allowedMentions: { users: [] },
    });
  },
};
