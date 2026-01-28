import { executeLookbackMembers } from "@/core/handlers/command-handlers/mod/lookback-members.handler";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class LookbackMembers {
  @Slash({
    name: "lookback-members",
    description: "Change lookback date range for guild",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async lookbackMembers(
    @SlashOption({
      name: "lookback",
      description: "Set lookback days range",
      required: true,
      minValue: 3,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    lookback: number,
    interaction: CommandInteraction,
  ) {
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "lookback-members",
        })
        .catch(() => {});
    }

    const result = await executeLookbackMembers(interaction, lookback);

    if ("error" in result) return interaction.reply(result.error);

    return interaction.reply(result.message);
  }
}
