import {
  ApplicationCommandOptionType,
  TextChannel,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { ConfigValidator } from "@/shared/config/validator";
import { BOT_CHANNELS } from "@/shared/config";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";

@Discord()
export class UserCommand {
  @Slash({
    name: "user",
    description: "Get stats from specific user",
    dmPermission: false,
  })
  async user(
    @SlashOption({
      name: "user",
      description: "Select user which stats should be shown",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    LogService.logCommandHistory(interaction, "user");
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

    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.editReply("Could not get guild info");
    }

    const userStats = await StatsService.getUserStatsEmbed(user.id, guildId);

    if (typeof userStats?.embed === "string")
      return await interaction.editReply(userStats?.embed);

    return await interaction.editReply({
      embeds: [userStats!.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
