import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SlashCommandBuilder } from '@discordjs/builders';
import {
  CacheType,
  CommandInteraction,
  MessageActionRow,
  Modal,
  TextInputComponent,
} from 'discord.js';
import axios from 'axios';
import type { QuestionRequest } from '../types/types';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('verify yourself with a catpcha question'),
  async execute(interaction: CommandInteraction<CacheType>) {
    const uniqueId = uuidv4();

    let questionRequest: { data: QuestionRequest } = {
      data: {
        q: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        a: [],
      },
    };

    while (questionRequest.data.q.length > 45) {
      console.log(questionRequest.data.q.length);
      try {
        questionRequest = await axios.get<QuestionRequest>(
          'http://api.textcaptcha.com/example.json'
        );
      } catch (_) {}
    }

    const modal = new Modal().setCustomId('verify').setTitle('Verify');

    const questionInput = new TextInputComponent()
      .setCustomId('questionInput')
      .setLabel(questionRequest.data.q)
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

    await interaction.showModal(modal);
  },
};
