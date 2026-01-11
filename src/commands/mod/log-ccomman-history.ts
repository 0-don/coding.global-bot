import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { commandHistoryEmbed } from "../../lib/embeds";
import { LogService } from "../../lib/logs/log.service";
import { prisma } from "../../prisma";

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

    LogService.logCommandHistory(interaction, "log-command-history");
    const guildId = interaction.guild?.id;

    const history = await prisma.memberCommandHistory.findMany({
      where: { guildId },
      take: count,
      orderBy: { createdAt: "desc" },
    });

    const embed = commandHistoryEmbed(history);

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
