import { GuildVoiceEvents } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { APIEmbed, TextChannel, VoiceState } from "discord.js";
import { prisma } from "../../prisma.js";
import { VOICE_EVENT_CHANNEL } from "../constants.js";
import { simpleEmbedExample } from "../embeds.js";
import { getDaysArray } from "../helpers.js";

dayjs.extend(utc);

export class VoiceService {
  static async closeDeadVoiceEvents() {
    // roll dice with if statemen 1/10 chance to run
    if (Math.floor(Math.random() * 10) === 0) return;

    const allOpenVoiceEvents = await prisma.guildVoiceEvents.findMany({
      where: { leave: null },
    });

    // dayjs if event is older than 10 days delete it
    allOpenVoiceEvents.forEach(async (event) => {
      if (dayjs().diff(dayjs(event.join), "days") > 10) {
        await prisma.guildVoiceEvents.delete({ where: { id: event.id } });
      }
    });
  }

  static async logVoiceEvents(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    try {
      // if mute, deafen, stream etc. => exit
      if (oldVoiceState.channelId === newVoiceState.channelId) return;

      // get voice channel by name
      const voiceEventsChannel = oldVoiceState.guild.channels.cache.find(({ name }) => name === VOICE_EVENT_CHANNEL);

      // check if voice channel exists and it is voice channel
      if (!voiceEventsChannel || !voiceEventsChannel.isTextBased()) return;

      const userServerName = newVoiceState.member?.user.toString();
      const userGlobalName = newVoiceState.member?.user.username;

      const oldChannel = oldVoiceState.channel?.name;
      const newChannel = newVoiceState.channel?.name;

      // copy paste embed so it doesnt get overwritten
      const voiceEmbed = JSON.parse(JSON.stringify(simpleEmbedExample)) as APIEmbed;

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
  }

  static async logVoiceEventsDb(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    const memberId = newVoiceState.member?.id ?? oldVoiceState.member?.id;
    const guildId = newVoiceState.guild.id ?? oldVoiceState.guild.id;
    const channelId = newVoiceState.channel?.id ?? oldVoiceState.channel?.id;

    if (!memberId || !guildId || !channelId) return;

    let lastVoiceEvent = await prisma.guildVoiceEvents.findFirst({
      where: { memberId },
      orderBy: { id: "desc" },
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
  }

  static async updateUserVoiceState(newVoiceState: VoiceState) {
    if (!newVoiceState.channel) return;

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          guildId: newVoiceState.guild.id,
          memberId: newVoiceState.member!.id,
        },
      },
      data: {
        deafened: newVoiceState.serverDeaf || false,
        muted: newVoiceState.serverMute || false,
      },
    });
  }
}

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
        leave: dayjs(lastVoiceEvent.join).utc().endOf("day").toDate(),
      },
    });
    lastVoiceEvent = await prisma.guildVoiceEvents.create({
      data: {
        memberId,
        channelId,
        guildId,
        join: dayjs(daysBetween[i]).utc().startOf("day").toDate(),
      },
    });
  }
  return lastVoiceEvent;
}
