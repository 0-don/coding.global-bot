import type { CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { ConfigValidator } from "@/shared/config/validator";
import { BOT_CHANNELS } from "@/shared/config/channels";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";

@Discord()
export class Me {
  @Slash({
    name: "me",
    description: "Get your stats",
    dmPermission: false,
  })
  async me(interaction: CommandInteraction) {
    await interaction.deferReply();

    LogService.logCommandHistory(interaction, "me");
    const channel = interaction.channel as TextChannel;

    if (ConfigValidator.isFeatureEnabled("IS_CONSTRAINED_TO_BOT_CHANNEL")) {
      if (!ConfigValidator.isFeatureEnabled("BOT_CHANNELS")) {
        ConfigValidator.logFeatureDisabled(
          "Bot Channel Restrictions",
          "BOT_CHANNELS",
        );
        return await interaction.editReply(
          "Bot channel restrictions are enabled but no bot channels are configured.",
        );
      }
      if (!BOT_CHANNELS.includes(channel.name)) {
        return await interaction.editReply(
          "Please use this command in the bot channel",
        );
      }
    }

    const memberId = interaction.member?.user.id;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) {
      return await interaction.editReply("Could not get user or guild info");
    }

    const userStats = await StatsService.getUserStatsEmbed(memberId, guildId);

    if (typeof userStats?.embed === "string")
      return await interaction.editReply(userStats?.embed);

    return await interaction.editReply({
      embeds: [userStats!.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
