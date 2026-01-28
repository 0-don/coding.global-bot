import { GuildMember, VoiceState } from "discord.js";
import { SHOULD_LOG_VOICE_EVENTS } from "@/shared/config/features";
import { MembersService } from "@/core/services/members/members.service";
import { MoveMemberToChannelService } from "@/core/services/members/move-member-to-channel.service";
import { VoiceService } from "@/core/services/voice/voice.service";
import { db } from "@/lib/db";
import { memberGuild } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";

export async function handleVoiceStateUpdate(
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState,
): Promise<void> {
  const member =
    newVoiceState?.member || (oldVoiceState?.member as GuildMember);
  const guild = newVoiceState?.guild || oldVoiceState?.guild;

  if (!member || !guild) return;

  const guildMember = await db.query.memberGuild.findFirst({
    where: and(
      eq(memberGuild.memberId, member.id),
      eq(memberGuild.guildId, guild.id),
    ),
  });

  if (guildMember?.moving && guildMember.moveCounter > 0) return;

  if (!oldVoiceState.channelId)
    await MembersService.joinSettings(
      newVoiceState.member as GuildMember,
      newVoiceState,
    );

  await VoiceService.updateUserVoiceState(newVoiceState);

  if (!oldVoiceState.channelId && newVoiceState.channelId)
    MoveMemberToChannelService.moveMemberToChannel(
      newVoiceState.member as GuildMember,
    );

  await VoiceService.logVoiceEventsDb(oldVoiceState, newVoiceState);

  if (SHOULD_LOG_VOICE_EVENTS) {
    await VoiceService.logVoiceEvents(oldVoiceState, newVoiceState);
  }

  await VoiceService.closeDeadVoiceEvents();
}
