import { SlashCommandBuilder } from '@discordjs/builders';
import type {
  APIEmbed,
  CacheType,
  CommandInteraction,
  TextChannel,
} from 'discord.js';
import { prisma } from '../prisma.js';
import {
  BOT_CHANNEL,
  BOT_ICON,
  BUMP_LEADERBOARDS_TEMPLATE,
  RED_COLOR,
} from './constants.js';
import { codeString, placementSuffix } from './helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('top-bumpers')
    .setDescription('look at the top bumpers'),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );

    // get top bumpers
    const bumps = await prisma.memberBump.findMany({
      where: { guildId: interaction.guild?.id },
      orderBy: { count: 'desc' },
      take: 25,
    });

    let fields = [];

    await interaction.guild?.members.fetch();

    for (let [i, { memberId, count }] of bumps.entries()) {
      // get member by id
      const member = interaction.guild?.members.cache.get(memberId);
      // make username clickable
      const userServerName = member?.user.toString();
      const userGlobalName = member?.user.username;
      // set place
      const place = i + 1;

      // create suffix 1st, 2nd, 3rd, etc.
      const suffix = placementSuffix(place);
      let medal = '🏅';
      if (place === 1) medal = '🥇';
      if (place === 2) medal = '🥈';
      if (place === 3) medal = '🥉';

      // return formatted string
      fields.push(
        `${medal} ${codeString(
          suffix
        )} ${userServerName} (${userGlobalName}) with **${count}** bumps`
      );
    }

    // create embed
    const embed: APIEmbed = {
      color: RED_COLOR,
      title: '🏆 Bump Leaderboards',
      description:
        `Look who has bumped the most times \n\n` + fields.join('\n'),
      timestamp: new Date().toISOString(),
      footer: {
        text: BUMP_LEADERBOARDS_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    // return embed, disable  user notifications
    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
