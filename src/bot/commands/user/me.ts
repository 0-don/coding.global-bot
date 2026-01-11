import { executeUserStatsCommand } from "@/core/handlers/command-handlers/user/user.handler";
import { LogService } from "@/core/services/logs/log.service";
import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";

@Discord()
export class MeCommand {
  @Slash({
    name: "me",
    description: "Get your stats",
    dmPermission: false,
  })
  async me(interaction: CommandInteraction) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "me");

    const result = await executeUserStatsCommand(interaction);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
