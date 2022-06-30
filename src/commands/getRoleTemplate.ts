import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';

import { v4 as uuidv4 } from 'uuid';
import { ROLE_TEMPLATE } from '../utils/constants';
import { megaUpload } from '../utils/megaUpload';
import { parseRoleTemplateFromMsg } from '../utils/roles/roleTemplate';

export default {
  data: new SlashCommandBuilder()
    .setName('get-role-template')
    .setDescription('get a role template as JSON')
    .addStringOption((option) =>
      option
        .setName('message-id')
        .setDescription('copy the message ID of the embeded message')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get message id
    const messageID = interaction.options.getString('message-id');

    // fetch message if it exists
    const msg = await interaction.channel?.messages.fetch(messageID!);

    // check if exits and if it is an embeded message
    if (!msg || msg.embeds[0]?.footer?.text !== ROLE_TEMPLATE) {
      return interaction.reply({
        content:
          "I can't find the message you're referring to OR\nit's not a role template.",
        ephemeral: true,
      });
    }
    // await for response
    await interaction.deferReply({ ephemeral: true });

    // get role template from message
    const roleTemplate = JSON.stringify(parseRoleTemplateFromMsg(msg), null, 1);
    // unique id for the file
    const fileName = `${uuidv4()}-roleTemplate.json`;

    // upload file to mega
    const content = await megaUpload(roleTemplate, fileName);

    // respond with either error or link
    interaction.editReply({ content });
  },
};
