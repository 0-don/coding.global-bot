import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { deleteUserMessages } from "../../lib/messages/delete-user-messages";

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
    interaction: CommandInteraction,
  ) {
    LogService.logCommandHistory(interaction, "delete-user-messages");
    const memberId = user?.id ?? userId;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) return;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    await deleteUserMessages({
      days: 7,
      guild: interaction.guild,
      memberId,
      jail,
      user,
    });

    // notify that messages were deleted
    await interaction.editReply({ content: "user messages are deleted" });
  }
}
