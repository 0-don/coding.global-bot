import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType,CommandInteraction } from 'discord.js';
import { deleteUserMessages } from '../utils/messages/deleteUserMessages.js';



export default {
  data: new SlashCommandBuilder()
    .setName('delete-user-messages')
    .setDescription('Deletes all messages from a user + mute them')
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
    .addBooleanOption((option) =>
      option
        .setName('jail')
        .setDescription(
          'Select either user ID which messages should be deleted'
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const user = interaction.options.getUser('user');

    // get user-id from slash command input
    const userId = interaction.options.get('user-id')?.value as string;

    // get how many days to delete
    const days = interaction.options.get('days')?.value as number;

    // mute user in db
    const jail = interaction.options.get('jail')?.value ?? false;

    const memberId = user?.id ?? userId;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) return;

    await interaction.deferReply({ ephemeral: true });

    await deleteUserMessages({
      days,
      guild: interaction.guild,
      memberId,
      jail,
      user,
    });

    // notify that messages were deleted
    await interaction.editReply({ content: 'user messages are deleted' });
  },
};
