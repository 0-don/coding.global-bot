import type { Event } from '../types';
import { logVoiceEvents } from '../utils/voiceEvents/logVoiceEvents';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldVoiceState, newVoiceState) {
    // log voice events in to specific channel

    // console.log(oldVoiceState, newVoiceState);

    await logVoiceEvents(oldVoiceState, newVoiceState);
  },
} as Event<'voiceStateUpdate'>;
