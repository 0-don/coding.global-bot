import type { MessageEmbedOptions, VoiceState } from 'discord.js';

const voiceEmbedExample: MessageEmbedOptions = {
  color: '#fd0000',
  description: ``,
  timestamp: new Date(),
  footer: {
    text: 'voice event',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};

export default {
  name: 'voiceStateUpdate',
  once: false,
  execute(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    // mute, deafen, stream etc.
    if (oldVoiceState.channelId === newVoiceState.channelId) return;

    const voiceEventsChannel = oldVoiceState.guild.channels.cache.find(
      ({ name }) => name === 'voice-events'
    );

    if (!voiceEventsChannel || !voiceEventsChannel.isText()) return;

    const userServerName = newVoiceState.member?.user.toString();
    const userGlobalName = newVoiceState.member?.user.username;

    const oldChannel = oldVoiceState.channel?.name;
    const newChannel = newVoiceState.channel?.name;

    const voiceEmbed = JSON.parse(
      JSON.stringify(voiceEmbedExample)
    ) as MessageEmbedOptions;

    voiceEmbed.timestamp = new Date();
    if (!oldChannel) {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) joined ${newChannel}`;
    } else if (!newChannel) {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) left ${oldChannel}`;
    } else {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) moved from ${oldChannel} to ${newChannel}`;
    }

    voiceEventsChannel.send({
      embeds: [voiceEmbed],
      allowedMentions: { users: [] },
    });
  },
};
