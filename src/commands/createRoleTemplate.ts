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
    const { roleTemplateEmbed, emojis, error } = createRoleTemplateEmbed(
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

    // const row = new MessageActionRow().addComponents(
    //   new MessageSelectMenu()
    //     .setCustomId('select')
    //     .setPlaceholder('Nothing selected')
    //     .setMinValues(1)
    //     .setMaxValues(14)
    //     .addOptions([
    //       {
    //         label: 'Select me',
    //         description: 'This is a description',
    //         value: 'first_option',
    //       },
    //       {
    //         label: 'You can select me too',
    //         description: 'This is also a description',
    //         value: 'second_option',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option2',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option3',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option4',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option5',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option6',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option7',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option8',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option9',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option10',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option11',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option12',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option13',
    //       },
    //       {
    //         label: 'I am also an option',
    //         description: 'This is a description as well',
    //         value: 'third_option14',
    //       },
    //     ])
    // );

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
