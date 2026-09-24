import { executeReport } from "@/core/handlers/command-handlers/user/report.handler";
import { safeDeferReply, safeEditReply, toUser } from "@/core/utils/command.utils";
import { MessageFlags } from "discord.js";
import type { CommandInteraction, User, GuildMember } from "discord.js";
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
    rawUser: User | GuildMember,
    @SlashOption({
      name: "reason",
      description: "Why are you reporting this member?",
      required: true,
      maxLength: 500,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
    interaction: CommandInteraction,
  ) {
    const user = toUser(rawUser)!;
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    // Not written to command history: /log-command-history would reveal who
    // sent each anonymous report.
    const result = await executeReport(interaction, user, reason);

    if ("error" in result) return safeEditReply(interaction, result.error);

    return safeEditReply(interaction, result.message);
  }
}
