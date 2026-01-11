import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { deleteUserMessages } from "@/core/services/messages/delete-user-messages";

@Discord()
export class DeleteMessages {
  @Slash({
    name: "delete-user-messages",
    description: "Deletes messages from a channel",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteMessages(
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
    const memberId = user?.id ?? userId;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) return;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    LogService.logCommandHistory(interaction, "delete-user-messages");

    await deleteUserMessages({
      guild: interaction.guild,
      memberId,
      jail,
      user,
      reason: reason ?? "Manual moderation",
    });

    await interaction.editReply({ content: "user messages are deleted" });
  }
}
