import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CacheType,
  type CommandInteraction,
  type Message,
} from 'discord.js';
import type { RoleTemplateReaction } from '../types/index.js';
import { parseJSON } from '../utils/helpers.js';
import { createRoleTemplateEmbed } from '../utils/roles/roleTemplate.js';

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
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get embed template as json
    const inputTemplate = parseJSON(
      interaction.options.get('json')?.value as string
    ) as RoleTemplateReaction;

    // create role template from input or get error
    const { roleTemplateEmbed, emojis, error } = await createRoleTemplateEmbed(
      inputTemplate,
      interaction.client
    );

    // error found while creating role template
    if (!roleTemplateEmbed || !emojis || error) {
      return interaction.reply({
        content: error ?? 'Something went wrong.',
        ephemeral: true,
      });
    }
    // create embeded message
    const message = await interaction.reply({
      embeds: [roleTemplateEmbed],
      fetchReply: true,
    });

    // create emoji reactions
    return emojis.forEach((emoji) => {
      if (!emoji) return;
      (message as Message<boolean>).react(emoji);
    });
  },
};
