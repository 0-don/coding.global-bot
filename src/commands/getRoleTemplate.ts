import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import fs from 'fs';
import { Storage } from 'megajs';
import { parseRoleTemplateFromMsg } from '../utils/roleTemplate';
import { v4 as uuidv4 } from 'uuid';

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
    if (!msg || msg.embeds[0]?.footer?.text !== 'role template') {
      return interaction.reply({
        content:
          "I can't find the message you're referring to OR\nit's not a role template.",
        ephemeral: true,
      });
    }

    // get role template from message
    const roleTemplate = parseRoleTemplateFromMsg(msg);
    await interaction.deferReply();

    // send role template as json
    const storage = await new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
    }).ready;

    try {
      // unique id for the file
      const fileName = `./${uuidv4()}-roleTemplate.json`;
      // create temp file with formatted json
      fs.writeFileSync(fileName, JSON.stringify(roleTemplate, null, 4));
      // read file as buffer
      const jsonFile = fs.readFileSync(fileName);
      // delete temp file
      fs.unlinkSync(fileName);

      // create folder if it doesn't exist
      await storage.mkdir(process.env.MEGA_DIR);

      // upload file to mega
      storage.root.children
        // search for created folder
        ?.find((e) => e.name === process.env.MEGA_DIR)
        // upload to specifc folder
        ?.upload(fileName.replace('./', ''), jsonFile, async (_, file) => {
          // create link from uploaded file
          const link = await file.link({ noKey: false });
          // send link to channel
          interaction.editReply({ content: link });
        });
    } catch (error) {
      // catch error and send it to user
      interaction.editReply({
        content: 'Something went wrong while uploading the file.',
      });
    }
  },
};
