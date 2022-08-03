import type { Event } from '../types';
import { logVoiceEvents } from '../utils/voiceEvents/logVoiceEvents';

export default {
  name: 'voiceStateUpdate',
  once: false,
  execute(oldVoiceState, newVoiceState) {
    // log voice events in to specific channel
    logVoiceEvents(oldVoiceState, newVoiceState);
  },
} as Event<'voiceStateUpdate'>;
