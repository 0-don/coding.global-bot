import { SlashCommandBuilder } from '@discordjs/builders';
import crypto from 'crypto';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import { ROLE_TEMPLATE } from '../utils/constants.js';
import { megaUpload } from '../utils/megaUpload.js';
import { parseRoleTemplateFromMsg } from '../utils/roles/roleTemplate.js';

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
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get message id
    const messageID = interaction.options.get('message-id')?.value as string;

    // fetch message if it exists
    const msg = await (interaction.channel as TextChannel)?.messages.fetch(
      messageID
    );

    // check if exits and if it is an embeded message
    if (!msg || msg.embeds[0]?.footer?.text !== ROLE_TEMPLATE) {
      return await interaction.reply({
        content:
          "I can't find the message you're referring to OR\nit's not a role template.",
        ephemeral: true,
      });
    }
    // await for response
    await interaction.deferReply({ ephemeral: true });

    // get role template from message
    const roleTemplate = JSON.stringify(
      await parseRoleTemplateFromMsg(msg),
      null,
      1
    );
    // unique id for the file
    const fileName = `${crypto.randomUUID()}-roleTemplate.json`;

    // upload file to mega
    const content = await megaUpload(roleTemplate, fileName);

    // respond with either error or link
    return await interaction.editReply({ content });
  },
};
