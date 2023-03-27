import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import type { RoleTemplateReaction } from '../types/index.js';
import { ROLE_TEMPLATE } from '../utils/constants.js';
import { parseJSON } from '../utils/helpers.js';
import { createRoleTemplateEmbed } from '../utils/roles/roleTemplate.js';

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
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get message id
    const messageID = interaction.options.get('message-id')?.value as string;

    // get role json template
    const inputTemplate = parseJSON(
      interaction.options.get('json')?.value as string
    ) as RoleTemplateReaction;

    // fetch message if it exists
    const msg = await (interaction.channel as TextChannel)?.messages.fetch(
      messageID
    );

    // check if exits and if it is an embeded role template message
    if (!msg || msg.embeds[0]?.footer?.text !== ROLE_TEMPLATE) {
      return await interaction.reply({
        content: `I can't find the message you're referring to **OR** it's not a ${ROLE_TEMPLATE}.`,
        ephemeral: true,
      });
    }

    // create role template from input or get error
    const { roleTemplateEmbed, error } = await createRoleTemplateEmbed(
      inputTemplate,
      interaction.client
    );

    // error found while creating role template
    if (!roleTemplateEmbed || error) {
      return await interaction.reply({
        content: error ?? 'Something went wrong.',
        ephemeral: true,
      });
    }

    // edit embeded message
    msg.edit({ embeds: [roleTemplateEmbed] });

    // notify it worked
    return await interaction.reply({
      content: "I've edited the message.",
      ephemeral: true,
    });
  },
};
