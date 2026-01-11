import { executeDeleteUserMessages } from "@/core/handlers/command-handlers/mod/delete-user-messages.handler";
import { LogService } from "@/core/services/logs/log.service";
import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class DeleteUserMessages {
  @Slash({
    name: "delete-user-messages",
    description: "Deletes messages from a channel",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteUserMessages(
    @SlashOption({
      name: "user",
      description: "Select existing user",
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "user-id",
      description: "Input user ID which messages should be deleted",
      type: ApplicationCommandOptionType.String,
    })
    userId: string,
    @SlashOption({
      name: "jail",
      description: "Should user be jailed",
      type: ApplicationCommandOptionType.Boolean,
    })
    jail: boolean = false,
    @SlashOption({
      name: "reason",
      description: "Reason for jailing (shown in jail channel)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    LogService.logCommandHistory(interaction, "delete-user-messages");

    const result = await executeDeleteUserMessages(
      interaction,
      user,
      userId,
      jail,
      reason,
    );

    if (result.error) return interaction.editReply(result.error);

    return interaction.editReply({ content: "user messages are deleted" });
  }
}
