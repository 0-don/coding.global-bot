import { PrismaClient } from '@prisma/client';
import type { VoiceState } from 'discord.js';

const prisma = new PrismaClient();

export const logVoiceEventsDb = async (
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState
) => {
  const memberId = newVoiceState.member?.id ?? oldVoiceState.member?.id;
  const guildId = newVoiceState.guild.id ?? oldVoiceState.guild.id;
  const channelId = newVoiceState.channel?.id ?? oldVoiceState.channel?.id;

  if (!memberId || !guildId || !channelId) return;

  const lastVoiceEvent = await prisma.guildVoiceEvents.findFirst({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
  });

  const lastMuteEvent = await prisma.guildMuteEvents.findFirst({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
  });

  // JOINED VOICE CHANNEL
  if (!oldVoiceState.channelId && newVoiceState.channelId) {
    if (lastVoiceEvent && lastVoiceEvent.type === 'JOIN')
      await prisma.guildVoiceEvents.delete({
        where: { id: lastVoiceEvent.id },
      });

    return await prisma.guildVoiceEvents.create({
      data: {
        memberId,
        channelId,
        guildId,
        type: 'JOIN',
      },
    });
  }

  // LEFT VOICE CHANNEL
  if (oldVoiceState.channelId && !newVoiceState.channelId) {
    if (lastVoiceEvent && lastVoiceEvent.type === 'LEAVE') return;
    return await prisma.guildVoiceEvents.create({
      data: {
        memberId,
        channelId,
        guildId,
        type: 'LEAVE',
      },
    });
  }

  // CHANGED VOICE CHANNEL
  if (oldVoiceState.channelId !== newVoiceState.channelId) {
    if (lastVoiceEvent && lastVoiceEvent.type === 'JOIN') {
    }
  }

  // MUTE STATE CHANGED
  if (oldVoiceState.channelId === newVoiceState.channelId) {
  }
  return;
};
