import { GuildMember } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { SHOULD_LOG_VOICE_EVENTS } from "@/shared/config";
import { joinSettings } from "@/core/services/members/join-nickname";
import { moveMemberToChannel } from "@/core/services/members/move-member-to-channel";
import { VoiceService } from "@/core/services/voice/voice.service";
import { prisma } from "@/prisma";

@Discord()
export class VoiceStateUpdate {
  @On()
  async voiceStateUpdate(
    [oldVoiceState, newVoiceState]: ArgsOf<"voiceStateUpdate">,
    client: Client,
  ) {
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
      await joinSettings(newVoiceState.member as GuildMember, newVoiceState);

    await VoiceService.updateUserVoiceState(newVoiceState);

    if (!oldVoiceState.channelId && newVoiceState.channelId)
      moveMemberToChannel(newVoiceState.member as GuildMember);

    // save logs to db
    await VoiceService.logVoiceEventsDb(oldVoiceState, newVoiceState);

    if (SHOULD_LOG_VOICE_EVENTS) {
      // internal logging
      await VoiceService.logVoiceEvents(oldVoiceState, newVoiceState);
    }

    await VoiceService.closeDeadVoiceEvents();
  }
}
