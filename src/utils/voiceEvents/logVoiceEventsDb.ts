import type { GuildVoiceEvents } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import type { VoiceState } from 'discord.js';
import { prisma } from '../../prisma.js';
import { getDaysArray } from '../helpers.js';

dayjs.extend(utc);

export const logVoiceEventsDb = async (
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState
) => {
  const memberId = newVoiceState.member?.id ?? oldVoiceState.member?.id;
  const guildId = newVoiceState.guild.id ?? oldVoiceState.guild.id;
  const channelId = newVoiceState.channel?.id ?? oldVoiceState.channel?.id;

  if (!memberId || !guildId || !channelId) return;

  let lastVoiceEvent = await prisma.guildVoiceEvents.findFirst({
    where: { memberId },
    orderBy: { id: 'desc' },
  });

  const data = {
    memberId,
    channelId,
    guildId,
    lastVoiceEvent,
  };

  // JOINED VOICE CHANNEL
  if (!oldVoiceState.channelId && newVoiceState.channelId) {
    // IF LAST VOICE EVENT WAS JOIN REMOVE IT BECAUSE OF DUPLICATE
    if (lastVoiceEvent?.leave === null)
      await prisma.guildVoiceEvents.delete({
        where: { id: lastVoiceEvent.id },
      });

    // CREATE VOICE EVENT AFTER JOIN
    return await prisma.guildVoiceEvents.create({
      data: { memberId, channelId, guildId },
    });
  }

  // LEFT VOICE CHANNEL
  if (oldVoiceState.channelId && !newVoiceState.channelId) {
    // CREATE VOICE EVENT AFTER LEAVE
    if (lastVoiceEvent?.leave === null) {
      lastVoiceEvent = await daysBetween(data);
      return await prisma.guildVoiceEvents.update({
        where: { id: lastVoiceEvent.id },
        data: { leave: new Date() },
      });
    }

    return;
  }

  // CHANGED VOICE CHANNEL
  if (oldVoiceState.channelId !== newVoiceState.channelId) {
    if (lastVoiceEvent?.leave === null) {
      lastVoiceEvent = await daysBetween(data);
      await prisma.guildVoiceEvents.update({
        where: { id: lastVoiceEvent.id },
        data: { leave: new Date() },
      });
    }

    return await prisma.guildVoiceEvents.create({
      data: { memberId, channelId, guildId },
    });
  }

  return;
};

async function daysBetween({
  lastVoiceEvent,
  memberId,
  channelId,
  guildId,
}: {
  memberId: string;
  channelId: string;
  guildId: string;
  lastVoiceEvent: GuildVoiceEvents | null;
}) {
  if (!lastVoiceEvent?.join) return lastVoiceEvent as GuildVoiceEvents;

  const now = new Date();
  const daysBetween = getDaysArray(lastVoiceEvent.join, now);
  if (daysBetween.length < 2) return lastVoiceEvent;

  for (let i = 1; i < daysBetween.length; i++) {
    await prisma.guildVoiceEvents.update({
      where: { id: lastVoiceEvent.id },
      data: {
        leave: dayjs(lastVoiceEvent.join).utc().endOf('day').toDate(),
      },
    });
    lastVoiceEvent = await prisma.guildVoiceEvents.create({
      data: {
        memberId,
        channelId,
        guildId,
        join: dayjs(daysBetween[i]).utc().startOf('day').toDate(),
      },
    });
  }
  return lastVoiceEvent;
}
