import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import {
  BOT_CHANNELS,
  BOT_ICON,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
  MEMBERS_TEMPLATE,
  RED_COLOR,
} from "../../lib/constants";
import { codeString } from "../../lib/helpers";
import { LogService } from "../../lib/logs/log.service";
import { MembersService } from "../../lib/members/members.service";

@Discord()
export class Members {
  @Slash({
    name: "members",
    description: "Memberflow and count of the past",
    dmPermission: false,
  })
  async members(interaction: CommandInteraction) {
    // deferReply first to avoid interaction timeout
    await interaction.deferReply();

    // get text channel
    LogService.logCommandHistory(interaction, "members");
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      // if not bot channel, return
      if (!BOT_CHANNELS.includes(channel.name))
        return await interaction.editReply(
          "Please use this command in the bot channel",
        );
    }
    // if somehow no guild, return
    if (!interaction.guild)
      return await interaction.editReply("Please use this command in a server");

    // get guild member chart data from specifc guild
    const chart = await MembersService.guildMemberCountChart(interaction.guild);

    // if error occured, return
    if (chart?.error) return await interaction.editReply(chart.error);

    const attachment = {
      attachment: chart.buffer!,
      name: chart.fileName!,
    };

    const count = interaction.guild.members.cache.size;
    const memberCount = interaction.guild.members.cache.filter(
      (member) => !member.user.bot,
    ).size;
    const botCount = count - memberCount;

    const thirtyDaysPercent = (chart.thirtyDaysCount! * 100) / memberCount;
    const sevenDaysPercent = (chart.sevedDaysCount! * 100) / memberCount;
    const oneDayPercent = (chart.oneDayCount! * 100) / memberCount;

    // create chart embed
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
      // prettier-ignore
      timestamp: new Date().toISOString(),
      image: { url: `attachment://${chart.fileName}` },
      footer: {
        text: MEMBERS_TEMPLATE,
        icon_url: BOT_ICON,
      },
    };

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  }
}
