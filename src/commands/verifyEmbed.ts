import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type {
  CacheType,
  CommandInteraction,
  MessageEmbedOptions,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify-embed')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    const embed: MessageEmbedOptions = {
      color: '#fd0000',
      title: 'Verification process...',
      description:
        'Type **/verfiy** followed by the answer to the captcha question.',
      timestamp: new Date(),
      footer: {
        text: 'verify yourself',
        icon_url:
          'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
      },
    };

    interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
