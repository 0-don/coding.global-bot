import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";
import { executeMembersCommand } from "@/core/handlers/command-handlers/user/members.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "members",
        })
        .catch(() => {});
    }

    const result = await executeMembersCommand(interaction);

    if ("error" in result) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, {
      embeds: [result.embed],
      files: [result.attachment],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
