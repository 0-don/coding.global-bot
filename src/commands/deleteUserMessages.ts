import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import dayjs from 'dayjs';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-user-messages')
    .setDescription('Deletes all messages from a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Select user which messages should be deleted')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('days')
        .setDescription('Delete message History')
        .setRequired(true)
        .addChoices(
          { name: 'Previous 24 Hours', value: '1' },
          { name: 'Previous 7 Days', value: '7' }
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // respond with either error or link

    const user = interaction.options.getUser('user')!;
    const days = interaction.options.getString('days')!;
    const daysTimestamp = dayjs().subtract(Number(days), 'day');

    const channels = interaction.guild?.channels.cache;

    if (!channels) return;

    await interaction.deferReply({ ephemeral: true });

    for (let channel of channels.values()) {
      if (channel.type !== 'GUILD_TEXT') continue;

      await channel.messages.fetch({ limit: 100 });
      const messages = channel.messages.cache.values();

      for (let message of messages) {
        // dont change it works
        if (
          message.author.id === user.id &&
          0 < dayjs(message.createdAt).diff(daysTimestamp, 'minutes')
        )
          await message.delete();
      }
    }

    interaction.editReply({ content: 'user messages are deleted' });
  },
};
