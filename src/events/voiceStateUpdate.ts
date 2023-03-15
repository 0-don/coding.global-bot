import type { GuildMember } from 'discord.js';
import type { Event } from '../types/index.js';
import { moveMemberToChannel } from '../utils/members/moveMemberToChannel.js';
import { logVoiceEvents } from '../utils/voiceEvents/logVoiceEvents.js';
import { logVoiceEventsDb } from '../utils/voiceEvents/logVoiceEventsDb.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldVoiceState, newVoiceState) {
    // log voice events in to specific channel

    // save logs to db
    await logVoiceEventsDb(oldVoiceState, newVoiceState);

    // internal logging
    await logVoiceEvents(oldVoiceState, newVoiceState);

    if (!oldVoiceState.channelId && newVoiceState.channelId)
      moveMemberToChannel(newVoiceState.member as GuildMember);
  },
} as Event<'voiceStateUpdate'>;
