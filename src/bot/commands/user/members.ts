import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { ConfigValidator } from "@/shared/config/validator";
import {
  BOT_CHANNELS,
  BOT_ICON,
  MEMBERS_TEMPLATE,
  RED_COLOR,
} from "@/shared/config";
import { codeString } from "@/shared/utils/index";
import { LogService } from "@/core/services/logs/log.service";
import { MembersService } from "@/core/services/members/members.service";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      LogService.logCommandHistory(interaction, "members");
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

      if (!interaction.guild)
        return await interaction.editReply(
          "Please use this command in a server",
        );

      const chart = await MembersService.guildMemberCountChart(
        interaction.guild,
      );

      if (chart?.error) return await interaction.editReply(chart.error);

      const attachment = {
        attachment: chart.buffer!,
        name: chart.fileName!,
      };

      let memberCount = 0;
      let botCount = 0;
      for (const member of interaction.guild.members.cache.values()) {
        if (member.user.bot) {
          botCount++;
        } else {
          memberCount++;
        }
      }

      const thirtyDaysPercent = (chart.thirtyDaysCount! * 100) / memberCount;
      const sevenDaysPercent = (chart.sevedDaysCount! * 100) / memberCount;
      const oneDayPercent = (chart.oneDayCount! * 100) / memberCount;

      const embed: APIEmbed = {
        color: RED_COLOR,
        title: `🛡️ ${interaction.guild?.name}'s Member Count Overview`,
        // prettier-ignore
        description:
       `
       Memberflow and count in the past ${chart.lookback} Days. (Change with the ${codeString("/lookback-members")} command.)

       **Members**
       Users: ${codeString(memberCount)}
       Bots: ${codeString(botCount)}

       **Memberflow 30 Days**
       Change: \`${(chart.thirtyDaysCount!<0?'':'+') + chart.thirtyDaysCount} members (${(thirtyDaysPercent!<0?'':'+')+ thirtyDaysPercent.toFixed(2)}%)\`
       **Memberflow 7 Days**
       Change: \`${(chart.sevedDaysCount!<0?'':'+') + chart.sevedDaysCount} members (${(sevenDaysPercent!<0?'':'+')+ sevenDaysPercent.toFixed(2)}%)\`
       **Memberflow 24 Hours**
       Change: \`${(chart.oneDayCount!<0?'':'+') + chart.oneDayCount} members (${(oneDayPercent!<0?'':'+')+ oneDayPercent.toFixed(2)}%)\`
       `,
        timestamp: new Date().toISOString(),
        image: { url: `attachment://${chart.fileName}` },
        footer: {
          text: MEMBERS_TEMPLATE,
          icon_url: BOT_ICON,
        },
      };

      return await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Members command error:", error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(
            "An error occurred while fetching member data.",
          );
        }
      } catch {
        // Ignore reply errors
      }
    }
  }
}
