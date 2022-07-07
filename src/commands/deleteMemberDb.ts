import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('delete-member-db')
    .setDescription('delete specific member from database')
    .addUserOption((option) =>
      option.setName('user').setDescription('select user').setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const user = interaction.options.getUser('user')!;

    try {
      await prisma.member.delete({
        where: { memberId: user.id },
        include: { bumps: true, guilds: true, roles: true },
      });
    } catch (_) {}

    return interaction.reply({ ephemeral: true, content: 'user data deleted' });
  },
};
