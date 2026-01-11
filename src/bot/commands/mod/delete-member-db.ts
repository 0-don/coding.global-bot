import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeDeleteMemberDb } from "@/core/handlers/command-handlers/mod/delete-member-db.handler";
import { LogService } from "@/core/services/logs/log.service";

@Discord()
export class DeleteMemberDb {
  @Slash({
    name: "delete-member-db",
    description: "delete specific member from this server's database",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteMemberDb(
    @SlashOption({
      name: "user",
      description: "select user",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    if (!interaction.guildId) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: "This command can only be used in a server",
      });
    }

    LogService.logCommandHistory(interaction, "delete-member-db");

    const result = await executeDeleteMemberDb(user.id, interaction.guildId);

    return interaction.reply({
      flags: [MessageFlags.Ephemeral],
      content: result.message,
    });
  }
}
