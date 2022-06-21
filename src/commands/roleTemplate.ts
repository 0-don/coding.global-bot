import { SlashCommandBuilder } from '@discordjs/builders';
import fs from 'fs';
import type {
  CacheType,
  CommandInteraction,
  Message,
  MessageEmbedOptions,
} from 'discord.js';
import type { RoleTemplateReaction } from '../types/types';
import path from 'path';

const exampleEmbed: MessageEmbedOptions = {
  color: '#fd0000',
  title: 'Server Roles',
  description: 'Select your roles',
  fields: [],
  timestamp: new Date(),
  footer: {
    text: 'coding.global',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};

const roleTemplatePath = path.join(
  __dirname,
  '../roleTemplates',
  'programming-languages.json'
);

export default {
  data: new SlashCommandBuilder()
    .setName('role-template')
    .setDescription('Create a role template from JSON')
    .addStringOption(
      (option) =>
        option
          .setName('json')
          .setDescription('JSON input for the role template')
      // .setRequired(true)
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // const string = interaction.options.getString('input');

    const template = JSON.parse(
      fs.readFileSync(roleTemplatePath, 'utf8')
    ) as RoleTemplateReaction;

    // parse emojis
    const emojis = template.reactions.map((reaction) => {
      if (!reaction?.emoji) return;
      const serverEmoji = interaction.client.emojis.cache.find(
        (emoji) => emoji.name === reaction.emoji
      );
      return `<:${reaction.emoji}:${serverEmoji?.id}>`;
    });

    exampleEmbed.title = template.title ?? exampleEmbed.title;
    exampleEmbed.description = template.description ?? exampleEmbed.description;

    // push template values into embed fields
    template.reactions.forEach((reaction, i) => {
      if (!reaction) return;
      exampleEmbed.fields?.push({
        name: `${emojis[i]} ${reaction.name}`,
        value: reaction.value,
        inline: true,
      });
    });

    // push empty to make it look nice if uneven ammount
    if (template.reactions.length % 3 === 2) {
      exampleEmbed.fields?.push({
        name: '\u200b',
        value: '\u200b',
        inline: true,
      });
    }

    // create embeded message
    const message = await interaction.reply({
      embeds: [exampleEmbed],
      fetchReply: true,
    });

    // create emoji reactions
    emojis.forEach((emoji) => {
      if (!emoji) return;
      (message as Message<boolean>).react(emoji);
    });
  },
};
