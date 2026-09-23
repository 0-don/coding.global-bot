import { ModLogService } from "@/core/services/moderation/modlog.service";
import { WarningsService } from "@/core/services/moderation/warnings.service";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import { MessageFlags } from "discord.js";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class DeleteWarning {
  @Slash({
    name: "delete-warning",
    description: "Delete a single warning by ID",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteWarning(
    @SlashOption({
      name: "warning_id",
      description: "The warning ID (shown in /warnings)",
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    warningId: number,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    if (!interaction.guildId) {
      return safeEditReply(
        interaction,
        "This command can only be used in a server",
      );
    }

    if (interaction.member?.user.id) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "delete-warning",
        })
        .catch(() => {});
    }

    const deleted = await WarningsService.deleteWarning(
      interaction.guildId,
      warningId,
    );

    if (!deleted) {
      return safeEditReply(
        interaction,
        `No warning found with ID #${warningId}`,
      );
    }

    if (interaction.guild) {
      await ModLogService.postLog({
        guild: interaction.guild,
        action: "delete-warning",
        targetId: deleted.memberId,
        moderatorId: interaction.member?.user.id,
        moderatorName: interaction.member?.user.username,
        reason: `Deleted warning #${warningId} (was: "${deleted.reason}")`,
      });
    }

    return safeEditReply(interaction, `Deleted warning #${warningId}`);
  }
}
