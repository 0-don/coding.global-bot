import { executeReport } from "@/core/handlers/command-handlers/user/report.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import { MessageFlags } from "discord.js";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Report {
  @Slash({
    name: "report",
    description: "Report a member to the moderators",
    dmPermission: false,
  })
  async report(
    @SlashOption({
      name: "user",
      description: "The member to report",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "reason",
      description: "Why are you reporting this member?",
      required: true,
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
          command: "report",
        })
        .catch(() => {});
    }

    const result = await executeReport(interaction, user, reason);

    if ("error" in result) return safeEditReply(interaction, result.error);

    return safeEditReply(interaction, result.message);
  }
}
