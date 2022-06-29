import type { VoiceState } from 'discord.js';
import { logVoiceEvents } from '../utils/voiceEvents/logVoiceEvents';

export default {
  name: 'voiceStateUpdate',
  once: false,
  execute(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    // log voice events in to specific channel
    logVoiceEvents(oldVoiceState, newVoiceState);
  },
};
