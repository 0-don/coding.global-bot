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
      type: ApplicationCommandOptionType.String,
    })
    count: string,
    interaction: CommandInteraction,
  ) {
    LogService.logCommandHistory(interaction, "log-deleted-messages-history");
    const c = count ? Number(count) : 10;
    const guildId = interaction.guild?.id;

    await interaction.deferReply();

    const history = await prisma.memberDeletedMessages.findMany({
      where: { guildId },
      take: c,
      orderBy: { createdAt: "desc" },
    });

    const embed = deletedMessagesHistoryEmbed(history);

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
