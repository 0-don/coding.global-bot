import type { CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { executeMembersCommand } from "@/core/handlers/command-handlers/user/members.handler";
import { LogService } from "@/core/services/logs/log.service";
import { checkBotChannelRestriction } from "@/core/utils/command.utils";

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

    const channelError = checkBotChannelRestriction(
      (interaction.channel as TextChannel).name,
    );
    if (channelError) return interaction.editReply(channelError);

    if (!interaction.guild)
      return interaction.editReply("Please use this command in a server");

    const result = await executeMembersCommand(interaction.guild);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      files: [result.attachment],
    });
  }
}
