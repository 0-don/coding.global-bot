import { executeLogDeletedMessagesHistory } from "@/core/handlers/command-handlers/mod/log-deleted-messages-history.handler";
import { LogService } from "@/core/services/logs/log.service";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class LogDeletedMessagesHistory {
  @Slash({
    name: "log-deleted-messages-history",
    description: "Show deleted messages",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of messages to show",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
    })
    count: number = 10,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "log-deleted-messages-history");

    const embed = await executeLogDeletedMessagesHistory(
      interaction.guild!.id,
      count,
    );

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
