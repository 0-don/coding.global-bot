import { SlashCommandBuilder } from '@discordjs/builders';
import type { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { CacheType, ChannelType, CommandInteraction } from 'discord.js';
import { prisma } from '../prisma';
import { MUTE } from '../utils/constants';
import { getGuildStatusRoles } from '../utils/roles/getGuildStatusRoles';

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
        .setName('mute')
        .setDescription(
          'Select either user ID which messages should be deleted'
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const user = interaction.options.getUser('user');

    // get user-id from slash command input
    const userId = interaction.options.get('user-id')?.value as string;

    // get how many days to delete
    const days = interaction.options.get('days')?.value as number;

    // mute user in db
    const mute = interaction.options.get('mute')?.value ?? false;

    const memberId = user?.id ?? userId;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) return;

    if (mute) {
      //get status roles
      const guildStatusRoles = getGuildStatusRoles(interaction.guild);

      // delete all roles
      await prisma.memberRole.deleteMany({
        where: {
          memberId,
          guildId,
        },
      });

      // role input
      const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
        roleId: guildStatusRoles[MUTE]!.id,
        memberId,
        guildId,
      };

      // create mute role
      await prisma.memberRole.upsert({
        where: {
          member_role: {
            memberId: memberRole.memberId,
            roleId: memberRole.roleId,
          },
        },
        create: memberRole,
        update: memberRole,
      });

      // if user still on server add mute role
      user &&
        interaction.guild.members.cache
          .get(user.id)!
          .roles.add(memberRole.roleId);
    }

    // create date before which messages should be deleted
    const daysTimestamp = dayjs().subtract(Number(days), 'day');

    // get all channels
    const channels = interaction.guild?.channels.cache;

    // if no channels exist, return
    if (!channels) return;

    // deferReply if it takes longer then usual
    await interaction.deferReply({ ephemeral: true });

    // loop over all channels
    for (let channel of channels.values()) {
      try {
        // if channel is not a text channel, continue
        if (channel.type !== ChannelType.GuildText) continue;

        //cache needs to be cleared
        channel.messages.cache.clear();
        await channel.messages.fetch({ limit: 100 });
        // create message array
        const messages = channel.messages.cache.values();

        // loop over all messages
        for (let message of messages) {
          // check if message was sent by user and if it was sent before daysTimestamp
          if (
            message.author.id === memberId &&
            0 < dayjs(message.createdAt).diff(daysTimestamp, 'minutes')
          )
            await message.delete();
        }
      } catch (_) {}
    }

    // notify that messages were deleted
    interaction.editReply({ content: 'user messages are deleted' });
  },
};
