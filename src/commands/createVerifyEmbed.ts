import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type {
  CacheType,
  CommandInteraction,
  MessageEmbedOptions,
  TextChannel,
} from 'discord.js';
import { VERIFY_CHANNEL, VERIFY_TEMPLATE } from '../utils/constants';

export default {
  data: new SlashCommandBuilder()
    .setName('create-verify-embed')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    if (channel.name !== VERIFY_CHANNEL) return;

    const embed: MessageEmbedOptions = {
      color: '#fd0000',
      title: 'Verification process...',
      description: `**--- :flag_gb: Welcome to our Coding Server! :flag_gb: ---**

We are dedicated members, who are professionally and in their spare time engaged in programming and other IT topics.
Most of the programmers here are trainees, students, apprentices or have started their own business in IT. 

We are not an IT helpdesk, but we are happy to answer a serious and level-headed question in between.
We generally don't like it so much when the sole purpose of being here is to answer a question and then leave the server once the question has been answered.

------------------- 🙂 Happy Coding 🙂 -------------------

--- :flag_de: Herzlich Willkommen auf unserem Coding Server! :flag_de: ---

Wir sind engagierte Member, die sich beruflich und in ihrer Freizeit mit dem Programmieren und weiteren IT Themen beschäftigen.
Die meisten hier anzutreffenden Programmierenden sind Azubis, Studenten, Ausgelernte, oder haben sich in der IT selbstständig gemacht. 

Wir sind kein IT-Helpdesk, beantworten aber gerne zwischendurch eine ernst gemeinte und niveauvolle Frage.
Wir mögen es generell nicht so sehr, wenn der einzige Zweck des Aufenthalts der Beantwortung einer Frage dient und der Server danach wieder verlassen wird, sobald die Frage beantwortet wurde.

------------------- 🙂 Happy Coding 🙂 -------------------

Type **/verify** followed by the answer to the captcha question.
`,
      timestamp: new Date(),
      footer: {
        text: VERIFY_TEMPLATE,
        icon_url:
          'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
      },
    };

    interaction.reply({ embeds: [embed] });
  },
};
