import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";
import { executeMembersCommand } from "@/core/handlers/command-handlers/user/members.handler";
import { LogService } from "@/core/services/logs/log.service";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "members");

    const result = await executeMembersCommand(interaction);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      files: [result.attachment],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
