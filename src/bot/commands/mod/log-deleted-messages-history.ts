import { deletedMessagesHistoryEmbed } from "@/core/embeds/deleted-messages.embed";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory, memberDeletedMessages } from "@/lib/db-schema";
import { desc, eq } from "drizzle-orm";
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
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "log-deleted-messages-history",
        })
        .catch(() => {});
    }

    const history = await db.query.memberDeletedMessages.findMany({
      where: eq(memberDeletedMessages.guildId, interaction.guild!.id),
      limit: count,
      orderBy: desc(memberDeletedMessages.createdAt),
    });

    const embed = deletedMessagesHistoryEmbed(history);

    await safeEditReply(interaction, {
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
