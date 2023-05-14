import { SlashCommandBuilder } from '@discordjs/builders';
import dayjs from 'dayjs';
import type { CacheType, CommandInteraction } from 'discord.js';
import { prisma } from '../prisma.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ai-reset')
    .setDescription('reset ai context'),
  async execute(interaction: CommandInteraction<CacheType>) {
    await interaction.deferReply();

    const user = interaction.user;

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          guildId: interaction.guildId!,
          memberId: user.id,
        },
      },
      data: { gptId: null, gptDate: dayjs().subtract(60, 'minute').toDate() },
    });

    return interaction.editReply('AI context reset');
  },
};
