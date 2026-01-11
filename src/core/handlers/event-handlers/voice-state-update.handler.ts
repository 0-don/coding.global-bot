import { GuildMember, VoiceState } from "discord.js";
import { SHOULD_LOG_VOICE_EVENTS } from "@/shared/config/features";
import { MembersService } from "@/core/services/members/members.service";
import { MoveMemberToChannelService } from "@/core/services/members/move-member-to-channel.service";
import { VoiceService } from "@/core/services/voice/voice.service";
import { prisma } from "@/prisma";

export async function handleVoiceStateUpdate(
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState,
): Promise<void> {
  const member =
    newVoiceState?.member || (oldVoiceState?.member as GuildMember);
  const guild = newVoiceState?.guild || oldVoiceState?.guild;

  if (!member || !guild) return;

  const memberGuild = await prisma.memberGuild.findFirst({
    where: {
      memberId: member.id,
      guildId: guild.id,
    },
  });

  if (memberGuild?.moving && memberGuild.moveCounter > 0) return;

  if (!oldVoiceState.channelId)
    await MembersService.joinSettings(newVoiceState.member as GuildMember, newVoiceState);

  await VoiceService.updateUserVoiceState(newVoiceState);

  if (!oldVoiceState.channelId && newVoiceState.channelId)
    MoveMemberToChannelService.moveMemberToChannel(newVoiceState.member as GuildMember);

  await VoiceService.logVoiceEventsDb(oldVoiceState, newVoiceState);

  if (SHOULD_LOG_VOICE_EVENTS) {
    await VoiceService.logVoiceEvents(oldVoiceState, newVoiceState);
  }

  await VoiceService.closeDeadVoiceEvents();
}
