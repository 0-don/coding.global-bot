import { SlashCommandBuilder } from '@discordjs/builders';
import { Message, MessageEmbed } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roleTemplate')
    .setDescription('Create a role template from JSON'),
  async execute(interaction: Message) {
    const exampleEmbed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Some title')
      .setURL('https://discord.js.org/')
      .setAuthor({
        name: 'Some name',
        iconURL:
          'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
        url: 'https://discord.js.org',
      })
      .setDescription('Some description here')
      .setThumbnail('https://i.imgur.com/AfFp7pu.png')
      .addFields(
        { name: 'Regular field title', value: 'Some value here' },
        { name: '\u200B', value: '\u200B' },
        { name: 'Inline field title', value: 'Some value here', inline: true },
        { name: 'Inline field title', value: 'Some value here', inline: true }
      )
      .addField('Inline field title', 'Some value here', true)
      .setImage('https://i.imgur.com/AfFp7pu.png')
      .setTimestamp()
      .setFooter({
        text: 'Some footer text here',
        iconURL: 'https://i.imgur.com/AfFp7pu.png',
      });
    await interaction.reply({ embeds: [exampleEmbed] });
  },
};
