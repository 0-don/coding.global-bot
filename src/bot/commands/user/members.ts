import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";
import { executeMembersCommand } from "@/core/handlers/command-handlers/user/members.handler";
import { prisma } from "@/prisma";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    await interaction.deferReply();
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory.create({
        data: {
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "members",
        },
      }).catch(() => {});
    }

    const result = await executeMembersCommand(interaction);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      files: [result.attachment],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
