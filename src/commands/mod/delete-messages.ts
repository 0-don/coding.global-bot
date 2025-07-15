import type { CommandInteraction, Message, TextChannel } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service.js";
import { fetchMessages } from "../../lib/messages/fetch-messages.js";

@Discord()
export class DeleteMessages {
  @Slash({
    name: "delete-messages",
    description: "Deletes messages from a channel",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async deleteMessages(
    @SlashOption({
      name: "amount",
      description: "Delete message amount",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    amount: number,
    interaction: CommandInteraction
  ) {
    LogService.logCommandHistory(interaction, "delete-messages");
    // get member from slash command input
    const channel = interaction.channel as TextChannel;
    const guildId = interaction.guild?.id;

    if (!guildId || !channel) return;

    // deferReply if it takes longer then usual
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
    return await interaction.editReply({ content: "messages are deleted" });
  }
}
