import path from 'path';
import fs from 'fs';
import { SlashCommandBuilder } from '@discordjs/builders';
import {
  CacheType,
  CommandInteraction,
  MessageActionRow,
  Modal,
  TextChannel,
  TextInputComponent,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { getQuestion } from '../utils/getQuestion';
import { PermissionFlagsBits } from 'discord-api-types/v9';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('verify yourself with a catpcha question')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendTTSMessages),
  async execute(interaction: CommandInteraction<CacheType>) {
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    if (channel.name !== 'verify') return;

    const uniqueId = uuidv4();

    const question = await getQuestion();

    // create a answer file for the modal event
    const fileName = `${uniqueId}.txt`;
    const filePath = path.join(path.resolve(), 'verifyFiles', fileName);
    fs.writeFileSync(filePath, question.a.join('\n'));

    const modal = new Modal().setCustomId('verify').setTitle('Verify');

    const questionInput = new TextInputComponent()
      .setCustomId('questionInput')
      .setValue('')
      .setLabel(question.q)
      .setStyle('SHORT');

    const idInput = new TextInputComponent()
      .setCustomId('id')
      .setValue(uniqueId)
      .setLabel("DONT CHANGE THIS IT'S USED TO VERIFY YOU")
      .setStyle('SHORT');

    // @ts-ignore
    const firstActionRow = new MessageActionRow().addComponents(questionInput);
    // @ts-ignore
    const secondActionRow = new MessageActionRow().addComponents(idInput);
    // @ts-ignore
    modal.addComponents(firstActionRow, secondActionRow);

    interaction.showModal(modal);
  },
};
