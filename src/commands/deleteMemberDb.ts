import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType,CommandInteraction } from 'discord.js';
import { prisma } from '../prisma.js';


export default {
  data: new SlashCommandBuilder()
    .setName('delete-member-db')
    .setDescription('delete specific member from database')
    .addUserOption((option) =>
      option.setName('user').setDescription('select user').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get member from slash command input
    const user = interaction.options.getUser('user');

    try {
      // try to delete member from database if it exists
      await prisma.member.delete({ where: { memberId: user?.id } });
    } catch (_) {
      // if member doesn't exist, return
      return await interaction.reply('user not found');
    }

    // confirm deletion
    return await interaction.reply({
      ephemeral: true,
      content: 'user data deleted',
    });
  },
};
