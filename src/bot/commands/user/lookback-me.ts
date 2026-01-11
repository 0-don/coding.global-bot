import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { LookbackService } from "@/core/services/members/lookback.service";
import { extractIds } from "@/bot/utils/command.utils";

@Discord()
export class LookbackMe {
  @Slash({
    name: "lookback-me",
    description: "Change lookback date range for yourself",
    dmPermission: false,
  })
  async lookbackMe(
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
    LogService.logCommandHistory(interaction, "lookback-me");

    const { guildId, memberId } = extractIds(interaction);
    if (!guildId || !memberId)
      return interaction.reply("Please use this command in a server");

    await LookbackService.setMemberLookback(memberId, guildId, lookback);

    return interaction.reply(
      `Lookback set to ${lookback} days for ${interaction.member?.user.username}`,
    );
  }
}
