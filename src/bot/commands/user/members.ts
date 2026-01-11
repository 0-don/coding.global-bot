import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { BOT_ICON, MEMBERS_TEMPLATE, RED_COLOR } from "@/shared/config/branding";
import { codeString } from "@/shared/utils/format.utils";
import { LogService } from "@/core/services/logs/log.service";
import { MembersService } from "@/core/services/members/members.service";
import { checkBotChannelRestriction } from "@/bot/utils/command.utils";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "members");

    const channelError = checkBotChannelRestriction(
      (interaction.channel as TextChannel).name,
    );
    if (channelError) return interaction.editReply(channelError);

    if (!interaction.guild)
      return interaction.editReply("Please use this command in a server");

    const chart = await MembersService.guildMemberCountChart(interaction.guild);
    if (chart?.error) return interaction.editReply(chart.error);

    const { memberCount, botCount } = this.countMembers(interaction.guild);

    const embed = this.buildEmbed(interaction.guild.name, chart, memberCount, botCount);
    const attachment = { attachment: chart.buffer!, name: chart.fileName! };

    return interaction.editReply({ embeds: [embed], files: [attachment] });
  }

  private countMembers(guild: NonNullable<CommandInteraction["guild"]>) {
    let memberCount = 0;
    let botCount = 0;
    for (const member of guild.members.cache.values()) {
      if (member.user.bot) botCount++;
      else memberCount++;
    }
    return { memberCount, botCount };
  }

  private buildEmbed(
    guildName: string,
    chart: Awaited<ReturnType<typeof MembersService.guildMemberCountChart>>,
    memberCount: number,
    botCount: number,
  ): APIEmbed {
    const formatChange = (count: number, percent: number) =>
      `\`${count >= 0 ? "+" : ""}${count} members (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%)\``;

    const thirtyDaysPercent = (chart.thirtyDaysCount! * 100) / memberCount;
    const sevenDaysPercent = (chart.sevedDaysCount! * 100) / memberCount;
    const oneDayPercent = (chart.oneDayCount! * 100) / memberCount;

    return {
      color: RED_COLOR,
      title: `${guildName}'s Member Count Overview`,
      description: `Memberflow and count in the past ${chart.lookback} Days. (Change with ${codeString("/lookback-members")}.)

**Members**
Users: ${codeString(memberCount)}
Bots: ${codeString(botCount)}

**Memberflow 30 Days**
Change: ${formatChange(chart.thirtyDaysCount!, thirtyDaysPercent)}
**Memberflow 7 Days**
Change: ${formatChange(chart.sevedDaysCount!, sevenDaysPercent)}
**Memberflow 24 Hours**
Change: ${formatChange(chart.oneDayCount!, oneDayPercent)}`,
      timestamp: new Date().toISOString(),
      image: { url: `attachment://${chart.fileName}` },
      footer: { text: MEMBERS_TEMPLATE, icon_url: BOT_ICON },
    };
  }
}
