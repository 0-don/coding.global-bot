import type { APIEmbed, Guild } from "discord.js";
import { BOT_ICON, MEMBERS_TEMPLATE, RED_COLOR } from "@/shared/config/branding";
import { codeString } from "@/shared/utils/format.utils";
import { MembersService } from "@/core/services/members/members.service";

export type MembersCommandResult = {
  embed: APIEmbed;
  attachment: { attachment: Buffer; name: string };
};

export async function executeMembersCommand(
  guild: Guild,
): Promise<MembersCommandResult | { error: string }> {
  const chart = await MembersService.guildMemberCountChart(guild);
  if (chart?.error) return { error: chart.error };

  const { memberCount, botCount } = countMembers(guild);
  const embed = buildEmbed(guild.name, chart, memberCount, botCount);
  const attachment = { attachment: chart.buffer!, name: chart.fileName! };

  return { embed, attachment };
}

function countMembers(guild: Guild) {
  let memberCount = 0;
  let botCount = 0;
  for (const member of guild.members.cache.values()) {
    if (member.user.bot) botCount++;
    else memberCount++;
  }
  return { memberCount, botCount };
}

function buildEmbed(
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
