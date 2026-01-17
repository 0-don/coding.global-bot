import { executeUserStatsCommand } from "@/core/handlers/command-handlers/user/user.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { prisma } from "@/prisma";
import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";

@Discord()
export class MeCommand {
  @Slash({
    name: "me",
    description: "Get your stats",
    dmPermission: false,
  })
  async me(interaction: CommandInteraction) {
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "me",
          },
        })
        .catch(() => {});
    }

    const result = await executeUserStatsCommand(interaction);

    if ("error" in result) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, {
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
