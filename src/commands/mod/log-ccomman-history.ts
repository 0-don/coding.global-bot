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
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of commands to show",
      type: ApplicationCommandOptionType.String,
    })
    count: string,
    interaction: CommandInteraction
  ) {
    LogService.logCommandHistory(interaction, "log-command-history");
    const c = count ? Number(count) : 10;
    const guildId = interaction.guild?.id;

    await interaction.deferReply();

    const history = await prisma.memberCommandHistory.findMany({
      where: { guildId },
      take: c,
      orderBy: { createdAt: "desc" },
    });

    const embed = commandHistoryEmbed(history);

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
