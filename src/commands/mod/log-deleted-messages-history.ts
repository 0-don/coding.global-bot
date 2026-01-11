import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { deletedMessagesHistoryEmbed } from "../../lib/embeds";
import { LogService } from "../../lib/logs/log.service";
import { prisma } from "../../prisma";

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
    const guildId = interaction.guild?.id;

    const history = await prisma.memberDeletedMessages.findMany({
      where: { guildId },
      take: count,
      orderBy: { createdAt: "desc" },
    });

    const embed = deletedMessagesHistoryEmbed(history);

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
