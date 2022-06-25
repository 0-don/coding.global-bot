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
        .setMaxValues(2)
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
        ])
    );

    await interaction.reply({ content: 'Pong!', components: [row] });
  },
};
