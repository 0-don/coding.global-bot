import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type {
CacheType,
CommandInteraction,
Message,
TextChannel,
} from 'discord.js';
import { fetchMessages } from '../utils/messages/fetchMessages.js';



export default {
  data: new SlashCommandBuilder()
    .setName('delete-messages')
    .setDescription('Deletes messages from a channel')
    .addStringOption((option) =>
      option
        .setName('amount')
        .setDescription('Delete message History')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const channel = interaction.channel as TextChannel;

    if (!channel) return;
    // get how many days to delete
    const amount = interaction.options.get('amount')?.value as number;

    const guildId = interaction.guild?.id;

    if (!guildId) return;

    // deferReply if it takes longer then usual
    await interaction.deferReply({ ephemeral: true });

    // loop over all channels
    const messages = await fetchMessages(channel, amount);

    // create list of messages 100 each
    const messageList = messages.reduce(
      (acc, message) => {
        const last = acc[acc.length - 1];
        if (last!.length === 100) {
          acc.push([message!]);
        } else {
          last!.push(message);
        }
        return acc;
      },
      [[]] as Message<boolean>[][]
    );

    for (const message of messageList) {
      await channel.bulkDelete(message, true);
    }

    // notify that messages were deleted
    return await interaction.editReply({ content: 'messages are deleted' });
  },
};
