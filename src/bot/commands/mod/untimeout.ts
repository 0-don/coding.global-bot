import { executeUntimeout } from "@/core/handlers/command-handlers/mod/untimeout.handler";
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
export class Untimeout {
  @Slash({
    name: "untimeout",
    description: "Lift a member's timeout",
    dmPermission: false,
  })
  async untimeout(
    @SlashOption({
      name: "user",
      description: "Member to remove the timeout from",
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
          command: "untimeout",
        })
        .catch(() => {});
    }

    const result = await executeUntimeout(interaction, target);

    await safeEditReply(interaction, {
      content: result.error ?? result.message ?? "Done.",
    });
  }
}
