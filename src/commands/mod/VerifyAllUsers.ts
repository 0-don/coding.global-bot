import type { CommandInteraction, TextChannel } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { Discord, Slash } from "discordx";

import { LogService } from "../../lib/logs/Log.service.js";
import { verifyAllUsers } from "../../lib/members/verifyAllUsers.js";

@Discord()
export class VerifyAllUsers {
  @Slash({
    name: "verify-all-users",
    description: "verify all users in the server",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async verifyAllUsers(interaction: CommandInteraction) {
    LogService.logCommandHistory(interaction, "verify-all-users");

    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const members = await verifyAllUsers(interaction.guild, interaction);

      return (interaction.channel as TextChannel)?.send({
        content: `Verified all users (${members?.size}) in ${interaction.guild.name}`,
      });
    } catch (error) {
      return interaction.editReply({
        content: "An error occured while verifying all users",
      });
    }
  }
}
