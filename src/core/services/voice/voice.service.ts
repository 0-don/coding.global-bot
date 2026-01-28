import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { TextChannel, VoiceState } from "discord.js";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { guildVoiceEvents, memberGuild } from "@/lib/db-schema";
import type { GuildVoiceEvents } from "@/lib/db-schema";
import { ConfigValidator } from "@/shared/config/validator";
import { VOICE_EVENT_CHANNELS } from "@/shared/config/channels";
import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { getDaysArray } from "@/shared/utils/date.utils";

dayjs.extend(utc);

export class VoiceService {
  private static _voiceLoggingWarningLogged = false;

  static async closeDeadVoiceEvents() {
    // roll dice with if statemen 1/10 chance to run
    if (Math.floor(Math.random() * 10) === 0) return;

    const allOpenVoiceEvents = await db.query.guildVoiceEvents.findMany({
      where: isNull(guildVoiceEvents.leave),
    });

    // dayjs if event is older than 10 days delete it
    allOpenVoiceEvents.forEach(async (event) => {
      if (dayjs().diff(dayjs(event.join), "days") > 10) {
        await db.delete(guildVoiceEvents).where(eq(guildVoiceEvents.id, event.id));
      }
    });
  }

  static async logVoiceEvents(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState,
  ) {
    if (!ConfigValidator.isFeatureEnabled("SHOULD_LOG_VOICE_EVENTS")) {
      if (!this._voiceLoggingWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Voice Event Logging",
          "SHOULD_LOG_VOICE_EVENTS",
        );
        this._voiceLoggingWarningLogged = true;
      }
      return;
    }

    if (!ConfigValidator.isFeatureEnabled("VOICE_EVENT_CHANNELS")) {
      if (!this._voiceLoggingWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Voice Event Logging",
          "VOICE_EVENT_CHANNELS",
        );
        this._voiceLoggingWarningLogged = true;
      }
      return;
    }

    try {
      // if mute, deafen, stream etc. => exit
      if (oldVoiceState.channelId === newVoiceState.channelId) return;

      // get voice channel by name
      const voiceEventsChannel = oldVoiceState.guild.channels.cache.find(
        ({ name }) => VOICE_EVENT_CHANNELS.includes(name),
      );

      // check if voice channel exists and it is voice channel
      if (!voiceEventsChannel || !voiceEventsChannel.isTextBased()) return;

      const userServerName = newVoiceState.member?.user.toString();
      const userGlobalName = newVoiceState.member?.user.username;

      const oldChannel = oldVoiceState.channel?.name;
      const newChannel = newVoiceState.channel?.name;

      // copy paste embed so it doesnt get overwritten
      const voiceEmbed = simpleEmbedExample();

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
        allowedMentions: { users: [], roles: [] },
      });
    } catch (_) {}
  }

  static async logVoiceEventsDb(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState,
  ) {
    const memberId = newVoiceState.member?.id ?? oldVoiceState.member?.id;
    const guildId = newVoiceState.guild.id ?? oldVoiceState.guild.id;
    const channelId = newVoiceState.channel?.id ?? oldVoiceState.channel?.id;

    if (!memberId || !guildId || !channelId) return;

    let lastVoiceEvent = await db.query.guildVoiceEvents.findFirst({
      where: eq(guildVoiceEvents.memberId, memberId),
      orderBy: desc(guildVoiceEvents.id),
    });

    const data = {
      memberId,
      channelId,
      guildId,
      lastVoiceEvent: lastVoiceEvent ?? null,
    };

    // JOINED VOICE CHANNEL
    if (!oldVoiceState.channelId && newVoiceState.channelId) {
      // IF LAST VOICE EVENT WAS JOIN REMOVE IT BECAUSE OF DUPLICATE
      if (lastVoiceEvent?.leave === null)
        await db.delete(guildVoiceEvents).where(eq(guildVoiceEvents.id, lastVoiceEvent.id));

      // CREATE VOICE EVENT AFTER JOIN
      const [created] = await db.insert(guildVoiceEvents)
        .values({ memberId, channelId, guildId })
        .returning();
      return created;
    }

    // LEFT VOICE CHANNEL
    if (oldVoiceState.channelId && !newVoiceState.channelId) {
      // CREATE VOICE EVENT AFTER LEAVE
      if (lastVoiceEvent?.leave === null) {
        lastVoiceEvent = await daysBetween(data);
        const [updated] = await db.update(guildVoiceEvents)
          .set({ leave: new Date().toISOString() })
          .where(eq(guildVoiceEvents.id, lastVoiceEvent!.id))
          .returning();
        return updated;
      }

      return;
    }

    // CHANGED VOICE CHANNEL
    if (oldVoiceState.channelId !== newVoiceState.channelId) {
      if (lastVoiceEvent?.leave === null) {
        lastVoiceEvent = await daysBetween(data);
        await db.update(guildVoiceEvents)
          .set({ leave: new Date().toISOString() })
          .where(eq(guildVoiceEvents.id, lastVoiceEvent!.id));
      }

      const [created] = await db.insert(guildVoiceEvents)
        .values({ memberId, channelId, guildId })
        .returning();
      return created;
    }

    return;
  }

  static async updateUserVoiceState(newVoiceState: VoiceState) {
    if (!newVoiceState.channel) return;

    await db.update(memberGuild)
      .set({
        deafened: newVoiceState.serverDeaf || false,
        muted: newVoiceState.serverMute || false,
      })
      .where(
        and(
          eq(memberGuild.guildId, newVoiceState.guild.id),
          eq(memberGuild.memberId, newVoiceState.member!.id),
        )
      );
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
  const daysBetween = getDaysArray(new Date(lastVoiceEvent.join), now);
  if (daysBetween.length < 2) return lastVoiceEvent;

  for (let i = 1; i < daysBetween.length; i++) {
    await db.update(guildVoiceEvents)
      .set({ leave: dayjs(lastVoiceEvent.join).utc().endOf("day").toISOString() })
      .where(eq(guildVoiceEvents.id, lastVoiceEvent.id));

    const [created] = await db.insert(guildVoiceEvents)
      .values({
        memberId,
        channelId,
        guildId,
        join: dayjs(daysBetween[i]).utc().startOf("day").toISOString(),
      })
      .returning();
    lastVoiceEvent = created;
  }
  return lastVoiceEvent;
}
