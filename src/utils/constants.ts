import type { MessageEmbedOptions } from 'discord.js';

export const statusRoles = [
  'verified',
  'voiceOnly',
  'readOnly',
  'mute',
  'unverified',
] as const;

export const voiceEmbedExample: MessageEmbedOptions = {
  color: '#fd0000',
  description: ``,
  timestamp: new Date(),
  footer: {
    text: 'voice event',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};

export const VOICE_EVENT_CHANNEL = 'voice-events';
