import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeTopCommand } from "@/core/handlers/command-handlers/user/top.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";

@Discord()
export class TopCommand {
  @Slash({
    name: "top",
    description: "Get top stats for the guild",
    dmPermission: false,
  })
  async top(
    @SlashOption({
      name: "lookback",
      description: "Lookback days",
      required: false,
      minValue: 1,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    lookback: number = 9999,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "top",
        })
        .catch(() => {});
    }

    const result = await executeTopCommand(interaction, lookback);

    if ("error" in result) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, {
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
