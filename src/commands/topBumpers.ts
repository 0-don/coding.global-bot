import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import type {
  CacheType,
  CommandInteraction,
  MessageEmbedOptions,
  TextChannel,
} from 'discord.js';
import {
  BOT_CHANNEL,
  BOT_ICON,
  BUMP_LEADERBOARDS_TEMPLATE,
  RED_COLOR,
} from '../utils/constants';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('top-bumpers')
    .setDescription('look at the top bumpers'),
  async execute(interaction: CommandInteraction<CacheType>) {
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    await interaction.deferReply();

    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    const bumps = await prisma.memberBump.findMany({
      where: { guildId: interaction.guild!.id },
      orderBy: { count: 'desc' },
      take: 25,
    });

    const fields = bumps.map(({ count, memberId }, index) => {
      const member = interaction.guild?.members.cache.get(memberId);

      const userServerName = member?.user.toString();
      const userGlobalName = member?.user.username;
      const place = index + 1;

      let medal = '🏅';
      if (place === 1) medal = '🥇';
      if (place === 2) medal = '🥈';
      if (place === 3) medal = '🥉';

      return {
        name: `${medal}${place}. ${userServerName} - ${userGlobalName}`,
        value: `${medal} **${count}** bumps`,
      };
    });

    const embed: MessageEmbedOptions = {
      color: RED_COLOR,
      title: '🏆 Bump Leaderboards',
      description: `Look who has bumped the most times`,
      timestamp: new Date(),
      fields,
      footer: {
        text: BUMP_LEADERBOARDS_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    return interaction.editReply({ embeds: [embed] });
  },
};
