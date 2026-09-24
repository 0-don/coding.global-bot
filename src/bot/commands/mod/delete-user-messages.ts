import { executeDeleteUserMessages } from "@/core/handlers/command-handlers/mod/delete-user-messages.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
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
    @SlashOption({
      name: "purge",
      description: "Delete their messages (default: true). Turn off to only jail",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    purge: boolean = true,
    @SlashOption({
      name: "days",
      description: "How many days back to delete (default 14, max 14)",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 14,
      required: false,
    })
    days: number | undefined,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] }))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "delete-user-messages",
        })
        .catch(() => {});
    }

    const result = await executeDeleteUserMessages(
      interaction,
      user,
      userId,
      jail,
      reason,
      purge,
      days,
    );

    if (result.error) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, { content: result.message || "user messages are deleted" });
  }
}
