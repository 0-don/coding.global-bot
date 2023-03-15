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

    if (!oldVoiceState.channelId && newVoiceState.channelId)
      moveMemberToChannel(newVoiceState.member as GuildMember);

    await updateUserVoiceState(newVoiceState);

    if (newVoiceState.channelId)
      await joinSettings(newVoiceState.member as GuildMember, newVoiceState);

    // save logs to db
    await logVoiceEventsDb(oldVoiceState, newVoiceState);

    // internal logging
    await logVoiceEvents(oldVoiceState, newVoiceState);
  },
} as Event<'voiceStateUpdate'>;
