import { executeWarnings } from "@/core/handlers/command-handlers/mod/warnings.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Warnings {
  // Not permission-gated at the Discord level: anyone may look up their own
  // record, and executeWarnings requires ManageRoles only to view someone
  // else's. A member who cannot see where they stand has no warning of the
  // jail coming at four.
  @Slash({
    name: "warnings",
    description: "List your warnings, or another member's if you can moderate",
    dmPermission: false,
  })
  async warnings(
    @SlashOption({
      name: "user",
      description: "The member to look up (defaults to yourself)",
      required: false,
      type: ApplicationCommandOptionType.User,
    })
    user: User | undefined,
    @SlashOption({
      name: "page",
      description: "Page number (default 1)",
      required: false,
      minValue: 1,
      type: ApplicationCommandOptionType.Integer,
    })
    page: number = 1,
    interaction: CommandInteraction,
  ) {
    // Your own record stays private; a moderator pulling up someone else keeps
    // the existing in-channel behaviour.
    const isSelf = !user || user.id === interaction.user.id;

    if (
      !(await safeDeferReply(
        interaction,
        isSelf ? { flags: [MessageFlags.Ephemeral] } : undefined,
      ))
    )
      return;

    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "warnings",
        })
        .catch(() => {});
    }

    const result = await executeWarnings(interaction, user, page);

    if ("error" in result) return safeEditReply(interaction, result.error);

    return safeEditReply(interaction, {
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
