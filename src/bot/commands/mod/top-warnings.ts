import { executeTopWarnings } from "@/core/handlers/command-handlers/mod/top-warnings.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class TopWarnings {
  @Slash({
    name: "top-warnings",
    description: "Leaderboard of the most warned members",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async topWarnings(
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
    if (!(await safeDeferReply(interaction))) return;

    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "top-warnings",
        })
        .catch(() => {});
    }

    const result = await executeTopWarnings(interaction, page);

    if ("error" in result) return safeEditReply(interaction, result.error);

    return safeEditReply(interaction, {
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
