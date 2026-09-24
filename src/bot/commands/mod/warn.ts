import { executeWarn } from "@/core/handlers/command-handlers/mod/warn.handler";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { MessageFlags } from "discord.js";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Warn {
  @Slash({
    name: "warn",
    description: "Warn a member",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async warn(
    @SlashOption({
      name: "user",
      description: "The member to warn",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "reason",
      description: "Reason for the warning",
      required: true,
      maxLength: 500,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "warn",
        })
        .catch(() => {});
    }

    const result = await executeWarn(interaction, user, reason);

    if ("error" in result) return safeEditReply(interaction, result.error);

    return safeEditReply(interaction, result.message);
  }
}
