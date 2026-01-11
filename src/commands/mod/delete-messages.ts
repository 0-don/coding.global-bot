import type { CommandInteraction, Message, TextChannel } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { fetchMessages } from "../../lib/messages/fetch-messages";

@Discord()
export class DeleteMessages {
  @Slash({
    name: "delete-messages",
    description: "Deletes messages from a channel",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteMessages(
    @SlashOption({
      name: "amount",
      description: "Delete message amount",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 1000,
    })
    amount: number,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    LogService.logCommandHistory(interaction, "delete-messages");
    const channel = interaction.channel as TextChannel;
    const guildId = interaction.guild?.id;

    if (!guildId || !channel) return;

    const messages = await fetchMessages(channel, amount);

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
      [[]] as Message<boolean>[][],
    );

    for (const message of messageList) {
      await channel.bulkDelete(message, true);
    }

    return await interaction.editReply({ content: "messages are deleted" });
  }
}
