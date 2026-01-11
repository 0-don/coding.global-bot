import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeLogCommandHistory } from "@/core/handlers/command-handlers/mod/log-command-history.handler";
import { LogService } from "@/core/services/logs/log.service";

@Discord()
export class LogCommandHistory {
  @Slash({
    name: "log-command-history",
    description: "Show command history",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of commands to show",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
    })
    count: number = 10,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "log-command-history");

    const embed = await executeLogCommandHistory(interaction.guild!.id, count);

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
