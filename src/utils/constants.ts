import type { MessageEmbedOptions } from 'discord.js';

export const statusRoles = [
  'verified',
  'voiceOnly',
  'readOnly',
  'mute',
  'unverified',
] as const;

export const VOICE_EVENT_CHANNEL = 'voice-events';
export const MEMBERS_COUNT_CHANNEL = 'Members:';

export const MAX_QUESTION_RETRIES = 3;
export const MAX_QUESTION_LENGTH = 45;

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

export const roleTemplateExampleEmbed: MessageEmbedOptions = {
  color: '#fd0000',
  title: 'Server Roles',
  description: 'Select your roles',
  fields: [],
  timestamp: new Date(),
  footer: {
    text: 'role template',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};
