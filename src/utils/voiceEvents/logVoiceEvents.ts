import type { MessageEmbedOptions, VoiceState } from 'discord.js';
import { voiceEmbedExample, VOICE_EVENT_CHANNEL } from '../constants';

export const logVoiceEvents = async (
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState
) => {
  // if mute, deafen, stream etc. => exit
  if (oldVoiceState.channelId === newVoiceState.channelId) return;

  // get voice channel by name
  const voiceEventsChannel = oldVoiceState.guild.channels.cache.find(
    ({ name }) => name === VOICE_EVENT_CHANNEL
  );

  // check if voice channel exists and it is voice channel
  if (!voiceEventsChannel || !voiceEventsChannel.isText()) return;

  const userServerName = newVoiceState.member?.user.toString();
  const userGlobalName = newVoiceState.member?.user.username;

  const oldChannel = oldVoiceState.channel?.name;
  const newChannel = newVoiceState.channel?.name;

  // copy paste embed so it doesnt get overwritten
  const voiceEmbed = JSON.parse(
    JSON.stringify(voiceEmbedExample)
  ) as MessageEmbedOptions;

  // create embed based on event
  voiceEmbed.timestamp = new Date();
  if (!oldChannel) {
    voiceEmbed.description = `${userServerName} (${userGlobalName}) joined ${newChannel}`;
  } else if (!newChannel) {
    voiceEmbed.description = `${userServerName} (${userGlobalName}) left ${oldChannel}`;
  } else {
    voiceEmbed.description = `${userServerName} (${userGlobalName}) moved from ${oldChannel} to ${newChannel}`;
  }

  // send embed event to voice channel
  voiceEventsChannel.send({
    embeds: [voiceEmbed],
    allowedMentions: { users: [] },
  });
};
