import { deletedMessagesHistoryEmbed } from "@/core/embeds/deleted-messages.embed";
import { LogService } from "@/core/services/logs/log.service";
import { prisma } from "@/prisma";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class LogDeletedMessagesHistory {
  @Slash({
    name: "log-deleted-messages-history",
    description: "Show deleted messages",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of messages to show",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
    })
    count: number = 10,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "log-deleted-messages-history");

    const history = await prisma.memberDeletedMessages.findMany({
      where: { guildId: interaction.guild!.id },
      take: count,
      orderBy: { createdAt: "desc" },
    });

    const embed = deletedMessagesHistoryEmbed(history);

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
