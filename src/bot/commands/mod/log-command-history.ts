import { commandHistoryEmbed } from "@/core/embeds/command-history.embed";
import { prisma } from "@/prisma";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class LogCommandHistory {
  @Slash({
    name: "log-command-history",
    description: "Show command history",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of commands to show",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
    })
    count: number = 10,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "log-command-history",
          },
        })
        .catch(() => {});
    }

    const history = await prisma.memberCommandHistory.findMany({
      where: { guildId: interaction.guild!.id },
      take: count,
      orderBy: { createdAt: "desc" },
    });

    const embed = commandHistoryEmbed(history);

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
