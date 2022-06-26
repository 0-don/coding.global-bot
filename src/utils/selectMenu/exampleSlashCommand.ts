import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import {
  CacheType,
  CommandInteraction,
  MessageActionRow,
  MessageSelectMenu,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('get a role template as JSON')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const row = new MessageActionRow().addComponents(
      new MessageSelectMenu()
        .setCustomId('select')
        .setPlaceholder('Nothing selected')
        .setMinValues(1)
        .setMaxValues(10)
        .addOptions([
          {
            label: 'Select me',
            description: 'This is a description',
            value: 'first_option',
          },
          {
            label: 'You can select me too',
            description: 'This is also a description',
            value: 'second_option',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option2',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option3',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option4',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option5',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option6',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option7',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option8',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option9',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option10',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option11',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option12',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option13',
          },
          {
            label: 'I am also an option',
            description: 'This is a description as well',
            value: 'third_option14',
          },
        ])
    );

    await interaction.reply({ content: 'Pong!', components: [row] });
  },
};
