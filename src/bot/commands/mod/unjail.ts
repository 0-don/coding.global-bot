import { executeUnjail } from "@/core/handlers/command-handlers/mod/unjail.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Unjail {
  @Slash({
    name: "unjail",
    description: "Release a member from jail",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async unjail(
    @SlashOption({
      name: "user",
      description: "The member to release",
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | undefined,
    @SlashOption({
      name: "user-id",
      description: "Member ID, if they cannot be picked from the list",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    userId: string | undefined,
    @SlashOption({
      name: "reason",
      description: "Why they are being released",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string | undefined,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction))) return;

    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "unjail",
        })
        .catch(() => {});
    }

    const result = await executeUnjail(interaction, user, userId, reason);

    if (result.error) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, result.message || "Member released.");
  }
}
