import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType, CommandInteraction, Message } from 'discord.js';
import type { RoleTemplateReaction } from '../types/types';
import { createRoleTemplateEmbed } from '../utils/roleTemplate';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { parseJSON } from '../utils/parseJSON';

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
    const { roleTemplateEmbed, emojis } = createRoleTemplateEmbed(
      inputTemplate,
      interaction.client
    );

    if (!roleTemplateEmbed || !emojis) {
      return;
    }
    // create embeded message
    const message = await interaction.reply({
      embeds: [roleTemplateEmbed],
      fetchReply: true,
    });

    console.log(emojis);

    // create emoji reactions
    emojis.forEach((emoji) => {
      if (!emoji) return;
      (message as Message<boolean>).react(emoji);
    });
  },
};
