import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { CacheType, ChannelType, CommandInteraction } from 'discord.js';

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
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get user from slash command input
    const channel = interaction.channel;
    if (channel == null) return;
    // get how many days to delete
    const amount = interaction.options.get('amount')?.value as number;

    const guildId = interaction.guild?.id;

    if (!guildId) return;

    // deferReply if it takes longer then usual
    await interaction.deferReply({ ephemeral: true });

    // loop over all channels

    try {
      // if channel is not a text channel, continue
      if (channel.type !== ChannelType.GuildText) return;
      for (let i = 0; i < Math.floor(amount / 100); i++) {
        let messagesToDelete = amount - i * 100;

        channel.messages.cache.clear();
        await channel.messages.fetch({
          limit: messagesToDelete > 100 ? 100 : messagesToDelete,
        });
        const messages = channel.messages.cache.values();

        let promises = [];
        for (let message of messages) {
          promises.push(message.delete());
        }
        await Promise.all(promises);
      }
    } catch (_) {}

    // notify that messages were deleted
    interaction.editReply({ content: 'messages are deleted' });
  },
};
