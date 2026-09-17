import { executeMute } from "@/core/handlers/command-handlers/mod/mute.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction, GuildMember } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Mute {
  // No defaultMemberPermissions: helpers hold no moderation permission by design,
  // so the role check in MuteService is the gate.
  @Slash({
    name: "mute",
    description: "Time out a member",
    dmPermission: false,
  })
  async mute(
    @SlashOption({
      name: "user",
      description: "Member to mute",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    target: GuildMember,
    @SlashOption({
      name: "duration",
      description: "How long, for example 10m, 2h, 1d",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    duration: string,
    @SlashOption({
      name: "reason",
      description: "Reason for the mute",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string | undefined,
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
          command: "mute",
        })
        .catch(() => {});
    }

    const result = await executeMute(interaction, target, duration, reason);

    await safeEditReply(interaction, {
      content: result.error ?? result.message ?? "Done.",
    });
  }
}
