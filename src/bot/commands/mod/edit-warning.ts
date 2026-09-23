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
export class EditWarning {
  @Slash({
    name: "edit-warning",
    description: "Edit the reason on an existing warning",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async editWarning(
    @SlashOption({
      name: "warning_id",
      description: "The warning ID (shown in /warnings)",
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    warningId: number,
    @SlashOption({
      name: "new_reason",
      description: "The new reason text",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    newReason: string,
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
          command: "edit-warning",
        })
        .catch(() => {});
    }

    const previous = await WarningsService.getWarningById(
      interaction.guildId,
      warningId,
    );

    const updated = await WarningsService.editWarning(
      interaction.guildId,
      warningId,
      newReason,
    );

    if (!updated) {
      return safeEditReply(
        interaction,
        `No warning found with ID #${warningId}`,
      );
    }

    if (interaction.guild) {
      await ModLogService.postLog({
        guild: interaction.guild,
        action: "edit-warning",
        targetId: updated.memberId,
        moderatorId: interaction.member?.user.id,
        moderatorName: interaction.member?.user.username,
        reason: `Warning #${warningId} changed from "${previous?.reason ?? "unknown"}" to "${newReason}"`,
      });
    }

    return safeEditReply(interaction, `Updated warning #${warningId}`);
  }
}
