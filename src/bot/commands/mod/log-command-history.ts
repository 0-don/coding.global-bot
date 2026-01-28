import { commandHistoryEmbed } from "@/core/embeds/command-history.embed";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import { desc, eq } from "drizzle-orm";
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
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "log-command-history",
        })
        .catch(() => {});
    }

    const history = await db.query.memberCommandHistory.findMany({
      where: eq(memberCommandHistory.guildId, interaction.guild!.id),
      limit: count,
      orderBy: desc(memberCommandHistory.createdAt),
    });

    const embed = commandHistoryEmbed(history);

    await safeEditReply(interaction, {
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
