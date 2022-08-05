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
  const selfMute = newVoiceState.selfMute ?? oldVoiceState.selfMute;

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
    // IF LAST VOICE EVENT WAS JOIN REMOVE IT BECAUSE OF DUPLICATE
    if (lastVoiceEvent && lastVoiceEvent.type === 'JOIN')
      await prisma.guildVoiceEvents.delete({
        where: { id: lastVoiceEvent.id },
      });

    // IF LAST MUTE EVENT WAS MUTE IT BECAUSE OF DUPLICATE
    if (lastMuteEvent && lastMuteEvent.type === 'MUTE')
      await prisma.guildMuteEvents.delete({
        where: { id: lastMuteEvent.id },
      });

    // IF USER JOINS MUTED TO A CHANNEL, LOG MUTE EVENT
    if (selfMute)
      await prisma.guildMuteEvents.create({
        data: {
          type: 'MUTE',
          memberId,
          guildId,
          channelId,
        },
      });

    // CREATE VOICE EVENT AFTER JOIN
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
    // IF VOICE CHANNEL LEAVE AND LAST EVENT LEAVE EXIT
    if (lastVoiceEvent && lastVoiceEvent.type === 'LEAVE') {
      // CHECK IF LAST MUTE EVENT WAS MUTE IF YES REMOVE BECAUSE DUPLICATE
      if (lastMuteEvent && lastMuteEvent.type === 'MUTE')
        await prisma.guildMuteEvents.delete({
          where: { id: lastMuteEvent.id },
        });
      return;
    }

    // IF VOICE CHANNEL LEAVE AND LAST EVENT MUTE CREATE UNMUTE EVENT
    if (lastMuteEvent && lastMuteEvent.type === 'MUTE')
      await prisma.guildMuteEvents.create({
        data: {
          type: 'UNMUTE',
          memberId,
          guildId,
          channelId,
        },
      });

    // CREATE VOICE EVENT AFTER LEAVE
    return (
      lastVoiceEvent &&
      lastVoiceEvent.type === 'JOIN' &&
      (await prisma.guildVoiceEvents.create({
        data: {
          memberId,
          channelId,
          guildId,
          type: 'LEAVE',
        },
      }))
    );
  }

  // CHANGED VOICE CHANNEL
  if (oldVoiceState.channelId !== newVoiceState.channelId) {
    if (lastVoiceEvent && lastVoiceEvent.type === 'LEAVE') {
      // CREATE JOIN EVENT FOR THE NEW CHANNEL
      await prisma.guildVoiceEvents.create({
        data: {
          memberId,
          channelId: newVoiceState.channelId!,
          guildId,
          type: 'JOIN',
        },
      });

      if (lastMuteEvent && lastMuteEvent.type === 'MUTE') {
        // IF IN DUPLICATE AND STILL MUTED REMOVE EVENT
        await prisma.guildMuteEvents.delete({
          where: { id: lastMuteEvent.id },
        });
        // CREATE NEW MUTE EVENT FOR THE NEW CHANNEL IF STILL MUTED
        if (selfMute) {
          await prisma.guildMuteEvents.create({
            data: {
              type: 'MUTE',
              memberId,
              guildId,
              channelId: newVoiceState.channelId!,
            },
          });
        }
      }

      return;
    }

    if (lastVoiceEvent && lastVoiceEvent.type === 'JOIN') {
      // CREATE LEAVE EVENT FOR THE OLD CHANNEL
      await prisma.guildVoiceEvents.create({
        data: {
          memberId,
          channelId: oldVoiceState.channelId!,
          guildId,
          type: 'LEAVE',
        },
      });

      // CREATE JOIN EVENT FOR THE NEW CHANNEL
      await prisma.guildVoiceEvents.create({
        data: {
          memberId,
          channelId: newVoiceState.channelId!,
          guildId,
          type: 'JOIN',
        },
      });

      if (lastMuteEvent && lastMuteEvent.type === 'MUTE') {
        // IF USER WAS MUTED BEFORE CHANNEL CHANGE CLOSE IT
        await prisma.guildMuteEvents.create({
          data: {
            type: 'UNMUTE',
            memberId,
            guildId,
            channelId: oldVoiceState.channelId!,
          },
        });
        // IF USER STILL MUTED AFTER SERVE CHANGE ADD MUTE EVENT
        if (selfMute) {
          await prisma.guildMuteEvents.create({
            data: {
              type: 'MUTE',
              memberId,
              guildId,
              channelId: newVoiceState.channelId!,
            },
          });
        }
      }
      return;
    }

    // IF NO MUTE LOGS EXIST CREATE MUTE LOG OR LAST LOG UNMUTE AND CURRENTLY MUTE
    if (!lastMuteEvent || (lastMuteEvent.type === 'UNMUTE' && selfMute)) {
      await prisma.guildMuteEvents.create({
        data: {
          type: 'MUTE',
          memberId,
          guildId,
          channelId: newVoiceState.channelId!,
        },
      });
    }

    // DELETE MUTE EVENT IF SOMEHOW OLD MUTE EXIST ON CHANNEL CHANGE
    if (lastMuteEvent && lastMuteEvent.type === 'MUTE') {
      await prisma.guildMuteEvents.delete({
        where: { id: lastMuteEvent.id },
      });
      // IF MUTED ON CHANNEL CHANGE CREATE NEW MUTE EVENT
      if (selfMute) {
        await prisma.guildMuteEvents.create({
          data: {
            type: 'MUTE',
            memberId,
            guildId,
            channelId: newVoiceState.channelId!,
          },
        });
      }
    }

    // CREATE VOICE IF NO EVENTS EXIST
    return await prisma.guildVoiceEvents.create({
      data: {
        memberId,
        channelId: newVoiceState.channelId!,
        guildId,
        type: 'JOIN',
      },
    });
  }

  // MUTE STATE CHANGED
  if (oldVoiceState.channelId === newVoiceState.channelId) {
    if (lastMuteEvent && lastMuteEvent.type === 'MUTE' && !selfMute) {
      // IF LAST MUTE LOG WAS MUTE AND NOW UNMUTE ADD LOG
      return await prisma.guildMuteEvents.create({
        data: {
          type: 'UNMUTE',
          memberId,
          guildId,
          channelId,
        },
      });
    }

    if (lastMuteEvent && lastMuteEvent.type === 'UNMUTE' && selfMute) {
      // IF LAST MUTE LOG WAS UNMUTE AND NOW MUTE ADD LOG
      return await prisma.guildMuteEvents.create({
        data: {
          type: 'MUTE',
          memberId,
          guildId,
          channelId,
        },
      });
    }

    // IF NO MUTE LOGS EXIST CREATE MUTE LOG
    if (selfMute) {
      await prisma.guildMuteEvents.create({
        data: {
          type: 'MUTE',
          memberId,
          guildId,
          channelId,
        },
      });
    }
  }
  return;
};
