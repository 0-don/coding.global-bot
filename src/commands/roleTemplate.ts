import { SlashCommandBuilder } from '@discordjs/builders';
import {
  CacheType,
  CommandInteraction,
  Message,
  MessageEmbed,
} from 'discord.js';

const exampleEmbed = new MessageEmbed()
  .setColor('#fd0000')
  .setTitle('Server Roles')
  .setAuthor({
    name: 'discord.global',
    iconURL:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
    url: 'https://coding.global',
  })
  .setDescription('Select your roles')
  .setThumbnail(
    'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png'
  )
  .addFields(
    { name: 'Regular field title', value: 'Some value here' },
    { name: '\u200B', value: '\u200B' }
  )
  .setFooter({
    text: 'Some footer text here',
    iconURL:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  });

export default {
  data: new SlashCommandBuilder()
    .setName('role-template')
    .setDescription('Create a role template from JSON')
    .addStringOption(
      (option) =>
        option
          .setName('input')
          .setDescription('JSON input for the role template')
      // .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const string = interaction.options.getString('input');

    const message = await interaction.reply({
      embeds: [exampleEmbed],
      // content: 'Select your roles',
      fetchReply: true,
    });

    (message as Message<boolean>).react(
      interaction.client.emojis.cache.find((emoji) => emoji.name === 'windows')!
        .id
    );
  },
};
