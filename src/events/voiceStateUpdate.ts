import type { VoiceState } from 'discord.js';

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

    const oldUser = oldVoiceState.member?.user.toString();
    const newUser = newVoiceState.member?.user.toString();

    const oldChannel = oldVoiceState.channel?.name;
    const newChannel = newVoiceState.channel?.name;

    voiceEventsChannel.send({
      content: `${oldUser} moved from ${oldChannel} to ${newChannel}`,
      allowedMentions: { users: [] },
    });
  },
};
