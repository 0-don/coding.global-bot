import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import type { RoleTemplateReaction } from '../types/types';
import { parseJSON } from '../utils/parseJSON';
import { createRoleTemplateEmbed } from '../utils/roleTemplate';

export default {
  data: new SlashCommandBuilder()
    .setName('edit-role-template')
    .setDescription('Create a role template from JSON')
    .addStringOption((option) =>
      option
        .setName('message-id')
        .setDescription('copy the message ID of the embeded message')
        .setRequired(true)
    )
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
    const messageID = interaction.options.getString('message-id');

    // get role json template
    const inputTemplate = parseJSON(
      interaction.options.getString('json')
    ) as RoleTemplateReaction;

    // fetch message if it exists
    const msg = await interaction.channel?.messages.fetch(messageID!);

    // check if exits and if it is an embeded message
    if (!msg || msg.type !== 'APPLICATION_COMMAND') {
      interaction.reply(
        "I can't find the message you're referring to or it's not an embeded message."
      );
      return;
    }

    // create role template from input or get error
    const { roleTemplateEmbed, error } = createRoleTemplateEmbed(
      inputTemplate,
      interaction.client
    );

    // error found while creating role template
    if (!roleTemplateEmbed || error) {
      await interaction.reply(error ?? 'Something went wrong.');
      return;
    }

    // edit embeded message
    await msg.edit({ embeds: [roleTemplateEmbed] });
  },
};
