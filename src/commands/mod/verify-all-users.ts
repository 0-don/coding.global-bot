import type { CommandInteraction, TextChannel } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { Discord, Slash } from "discordx";

import { LogService } from "../../lib/logs/log.service";
import { verifyAllUsers } from "../../lib/members/verify-all-users";

@Discord()
export class VerifyAllUsers {
  @Slash({
    name: "verify-all-users",
    description: "verify all users in the server",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
      dmPermission: false, 
  })
  async verifyAllUsers(interaction: CommandInteraction) {
    LogService.logCommandHistory(interaction, "verify-all-users");

    if (!interaction.guild) return;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
