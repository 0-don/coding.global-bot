import { executeJail } from "@/core/handlers/command-handlers/mod/jail.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Jail {
  @Slash({
    name: "jail",
    description: "Jail a member, optionally purging their recent messages",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async jail(
    @SlashOption({
      name: "user",
      description: "Select existing user",
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "user-id",
      description: "Member ID, if they cannot be picked from the list",
      type: ApplicationCommandOptionType.String,
    })
    userId: string,
    @SlashOption({
      name: "reason",
      description: "Reason for the jail (shown in the jail channel)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string | undefined,
    @SlashOption({
      name: "purge",
      description: "Also delete their recent messages (default: true)",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    deleteMessages: boolean = true,
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
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "jail",
        })
        .catch(() => {});
    }

    const result = await executeJail(
      interaction,
      user,
      userId,
      reason,
      deleteMessages,
      days,
    );

    if (result.error) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, {
      content: result.message || "Member jailed",
    });
  }
}
