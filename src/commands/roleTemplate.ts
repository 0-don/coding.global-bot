import { SlashCommandBuilder } from '@discordjs/builders';
import fs from 'fs';
import type { CacheType, CommandInteraction, Message } from 'discord.js';
import type { RoleTemplateReaction } from '../types/types';
import path from 'path';
import { createRoleTemplateEmbed } from '../utils/roleTemplate';

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

    const inputTemplate = JSON.parse(
      fs.readFileSync(roleTemplatePath, 'utf8')
    ) as RoleTemplateReaction;

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

    // create emoji reactions
    emojis.forEach((emoji) => {
      if (!emoji) return;
      (message as Message<boolean>).react(emoji);
    });
  },
};
