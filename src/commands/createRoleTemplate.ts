import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, Message } from 'discord.js';
import type { RoleTemplateReaction } from '../types/types';

import { PermissionFlagsBits } from 'discord-api-types/v9';
import { parseJSON } from '../utils/parseJSON';
import { createRoleTemplateEmbed } from '../utils/roles/roleTemplate';

export default {
  data: new SlashCommandBuilder()
    .setName('create-role-template')
    .setDescription('Create a role template from JSON')
    .addStringOption((option) =>
      option
        .setName('json')
        .setDescription('JSON input for the role template')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get message id
    const inputTemplate = parseJSON(
      interaction.options.getString('json')!
    ) as RoleTemplateReaction;

    // create role template from input or get error
    const { roleTemplateEmbed, emojis, error } = await createRoleTemplateEmbed(
      inputTemplate,
      interaction.client
    );

    // error found while creating role template
    if (!roleTemplateEmbed || !emojis || error) {
      interaction.reply({
        content: error ?? 'Something went wrong.',
        ephemeral: true,
      });
      return;
    }
    // create embeded message
    const message = await interaction.reply({
      embeds: [roleTemplateEmbed],
      // components: [row],
      fetchReply: true,
    });

    // create emoji reactions
    emojis.forEach((emoji) => {
      if (!emoji) return;
      (message as Message<boolean>).react(emoji);
    });
  },
};
