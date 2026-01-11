import { membersEmbed } from "@/core/embeds/members.embed";
import { MembersService } from "@/core/services/members/members.service";
import { checkBotChannelRestriction } from "@/core/utils/command.utils";
import type { MembersCommandResult } from "@/types";
import type { CommandInteraction, TextChannel } from "discord.js";

export async function executeMembersCommand(
  interaction: CommandInteraction,
): Promise<MembersCommandResult> {
  const channelName = (interaction.channel as TextChannel)?.name ?? "";
  const channelError = checkBotChannelRestriction(channelName);
  if (channelError) return { error: channelError };

  if (!interaction.guild)
    return { error: "Please use this command in a server" };

  const chart = await MembersService.guildMemberCountChart(interaction.guild);
  if (chart?.error) return { error: chart.error };

  let memberCount = 0;
  let botCount = 0;
  for (const member of interaction.guild.members.cache.values()) {
    if (member.user.bot) botCount++;
    else memberCount++;
  }

  const embed = membersEmbed(
    interaction.guild.name,
    chart,
    memberCount,
    botCount,
  );
  const attachment = { attachment: chart.buffer!, name: chart.fileName! };

  return { embed, attachment };
}
