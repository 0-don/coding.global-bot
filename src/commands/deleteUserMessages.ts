import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import dayjs from 'dayjs';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-user-messages')
    .setDescription('Deletes all messages from a user')
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
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Select either user which messages should be deleted')
    )
    .addStringOption((option) =>
      option
        .setName('user-id')
        .setDescription(
          'Select either user ID which messages should be deleted'
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const user = interaction.options.getUser('user');

    // get user-id from slash command input
    const userId = interaction.options.getString('user-id');

    // get how many days to delete
    const days = interaction.options.getString('days');
    // create date before which messages should be deleted
    const daysTimestamp = dayjs().subtract(Number(days), 'day');

    // get all channels
    const channels = interaction.guild?.channels.cache;

    const finalId = user?.id || userId;

    // if no channels exist, return
    if (!channels) return;

    // deferReply if it takes longer then usual
    await interaction.deferReply({ ephemeral: true });

    // loop over all channels
    for (let channel of channels.values()) {
      // if channel is not a text channel, continue
      if (channel.type !== 'GUILD_TEXT') continue;

      // get all messages from channel its limited by 100 cant get more
      await channel.messages.fetch({ limit: 100 });
      // create message array
      const messages = channel.messages.cache.values();

      // loop over all messages
      for (let message of messages) {
        // check if message was sent by user and if it was sent before daysTimestamp
        if (
          message.author.id === finalId &&
          0 < dayjs(message.createdAt).diff(daysTimestamp, 'minutes')
        )
          await message.delete();
      }
    }

    // notify that messages were deleted
    interaction.editReply({ content: 'user messages are deleted' });
  },
};
