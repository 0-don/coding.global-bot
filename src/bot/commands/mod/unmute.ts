import { executeUnmute } from "@/core/handlers/command-handlers/mod/unmute.handler";
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
export class Unmute {
  @Slash({
    name: "unmute",
    description: "Lift a member's timeout",
    dmPermission: false,
  })
  async unmute(
    @SlashOption({
      name: "user",
      description: "Member to unmute",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    target: GuildMember,
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
          command: "unmute",
        })
        .catch(() => {});
    }

    const result = await executeUnmute(interaction, target);

    await safeEditReply(interaction, {
      content: result.error ?? result.message ?? "Done.",
    });
  }
}
