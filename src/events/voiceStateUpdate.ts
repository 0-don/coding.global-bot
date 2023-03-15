import type { GuildMember } from 'discord.js';
import { prisma } from '../prisma.js';
import type { Event } from '../types/index.js';
import { joinSettings } from '../utils/members/joinNickname.js';
import { moveMemberToChannel } from '../utils/members/moveMemberToChannel.js';
import { logVoiceEvents } from '../utils/voice/logVoiceEvents.js';
import { logVoiceEventsDb } from '../utils/voice/logVoiceEventsDb.js';
import { updateUserVoiceState } from '../utils/voice/updateUserVoiceState.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldVoiceState, newVoiceState) {
    const memberGuild = await prisma.memberGuild.findFirst({
      where: {
        memberId: newVoiceState?.member?.id || oldVoiceState?.member?.id,
        guildId: newVoiceState?.guild?.id || oldVoiceState?.guild?.id,
      },
    });

    if (!memberGuild || memberGuild?.moving) return;

    if (!oldVoiceState.channelId && newVoiceState.channelId)
      return moveMemberToChannel(newVoiceState.member as GuildMember);

    if (newVoiceState.channelId)
      await joinSettings(newVoiceState.member as GuildMember);

    // save logs to db
    await logVoiceEventsDb(oldVoiceState, newVoiceState);

    // internal logging
    await logVoiceEvents(oldVoiceState, newVoiceState);

    await updateUserVoiceState(newVoiceState);
  },
} as Event<'voiceStateUpdate'>;
