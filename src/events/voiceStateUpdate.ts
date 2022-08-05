import type { Event } from '../types';
import { logVoiceEvents } from '../utils/voiceEvents/logVoiceEvents';
// import { logVoiceEventsDb } from '../utils/voiceEvents/logVoiceEventsDb';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldVoiceState, newVoiceState) {
    // log voice events in to specific channel
    console.log('#######');

    // save logs to db
    // await logVoiceEventsDb(oldVoiceState, newVoiceState);

    // internal logging
    await logVoiceEvents(oldVoiceState, newVoiceState);
  },
} as Event<'voiceStateUpdate'>;
