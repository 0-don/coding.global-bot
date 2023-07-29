import type { APIEmbed, TextChannel, VoiceState } from 'discord.js';
import { VOICE_EVENT_CHANNEL, simpleEmbedExample } from '../constants.js';

export const logVoiceEvents = async (
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState
) => {
  try {
    // if mute, deafen, stream etc. => exit
    if (oldVoiceState.channelId === newVoiceState.channelId) return;

    // get voice channel by name
    const voiceEventsChannel = oldVoiceState.guild.channels.cache.find(
      ({ name }) => name === VOICE_EVENT_CHANNEL
    );

    // check if voice channel exists and it is voice channel
    if (!voiceEventsChannel || !voiceEventsChannel.isTextBased()) return;

    const userServerName = newVoiceState.member?.user.toString();
    const userGlobalName = newVoiceState.member?.user.username;

    const oldChannel = oldVoiceState.channel?.name;
    const newChannel = newVoiceState.channel?.name;

    // copy paste embed so it doesnt get overwritten
    const voiceEmbed = JSON.parse(
      JSON.stringify(simpleEmbedExample)
    ) as APIEmbed;

    // create embed based on event
    voiceEmbed.timestamp = new Date().toISOString();
    if (!oldChannel) {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) joined ${newChannel}`;
    } else if (!newChannel) {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) left ${oldChannel}`;
    } else {
      voiceEmbed.description = `${userServerName} (${userGlobalName}) moved from ${oldChannel} to ${newChannel}`;
    }

    // send embed event to voice channel
    (voiceEventsChannel as TextChannel).send({
      embeds: [voiceEmbed],
      allowedMentions: { users: [] },
    });
  } catch (_) {}
};
