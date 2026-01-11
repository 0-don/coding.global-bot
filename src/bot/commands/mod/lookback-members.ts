import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { LookbackService } from "@/core/services/members/lookback.service";

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
    LogService.logCommandHistory(interaction, "lookback-members");

    const guildId = interaction.guild?.id;
    const guildName = interaction.guild?.name;

    if (!guildId || !guildName)
      return interaction.reply("Please use this command in a server");

    await LookbackService.setGuildLookback(guildId, guildName, lookback);

    return interaction.reply(`Lookback set to ${lookback} days for ${guildName}`);
  }
}
