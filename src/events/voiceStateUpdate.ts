import type { Event } from '../types/index.js';
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
  },
} as Event<'voiceStateUpdate'>;
