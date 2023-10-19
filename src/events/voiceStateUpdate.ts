import type { GuildMember } from "discord.js";
import { joinSettings } from "../modules/members/joinNickname.js";
import { moveMemberToChannel } from "../modules/members/moveMemberToChannel.js";
import { closeDeadVoiceEvents } from "../modules/voice/closeDeadVoiceEvents.js";
import { logVoiceEvents } from "../modules/voice/logVoiceEvents.js";
import { logVoiceEventsDb } from "../modules/voice/logVoiceEventsDb.js";
import { updateUserVoiceState } from "../modules/voice/updateUserVoiceState.js";
import { prisma } from "../prisma.js";
import type { Event } from "../types/index.js";

export default {
  name: "voiceStateUpdate",
  once: false,
  async execute(oldVoiceState, newVoiceState) {
    const member =
      newVoiceState?.member || (oldVoiceState?.member as GuildMember);
    const guild = newVoiceState?.guild || oldVoiceState?.guild;
    const memberGuild = await prisma.memberGuild.findFirst({
      where: {
        memberId: member.id,
        guildId: guild.id,
      },
    });

    if (memberGuild?.moving && memberGuild.moveCounter > 0) return;

    if (!oldVoiceState.channelId)
      await joinSettings(newVoiceState.member as GuildMember, newVoiceState);

    await updateUserVoiceState(newVoiceState);

    if (!oldVoiceState.channelId && newVoiceState.channelId)
      moveMemberToChannel(newVoiceState.member as GuildMember);

    // save logs to db
    await logVoiceEventsDb(oldVoiceState, newVoiceState);

    // internal logging
    await logVoiceEvents(oldVoiceState, newVoiceState);

    await closeDeadVoiceEvents();
  },
} as Event<"voiceStateUpdate">;
