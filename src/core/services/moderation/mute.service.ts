import { ModLogService } from "@/core/services/moderation/modlog.service";
import { db } from "@/lib/db";
import { memberMute } from "@/lib/db-schema";
import {
  MUTE_LIMIT_MINUTES,
  formatDuration,
  type ModeratorTier,
} from "@/shared/config/moderation";
import { HELPER_ROLES, STAFF_ROLES } from "@/shared/config/roles";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { GuildMember } from "discord.js";

type MuteRecord = typeof memberMute.$inferSelect;

export type MuteResult = { ok: true; message: string } | { ok: false; error: string };

export class MuteService {
  static resolveTier(member: GuildMember): ModeratorTier | null {
    const roles = member.roles.cache;
    if (roles.some((role) => STAFF_ROLES.includes(role.name))) return "staff";
    if (roles.some((role) => HELPER_ROLES.includes(role.name))) return "helper";
    return null;
  }

  private static isStaff(member: GuildMember): boolean {
    return member.roles.cache.some((role) => STAFF_ROLES.includes(role.name));
  }

  private static isHelper(member: GuildMember): boolean {
    return member.roles.cache.some((role) => HELPER_ROLES.includes(role.name));
  }

  // Discord's timeout is a single value, so re-muting a member REPLACES the
  // standing timeout: shortening a staff mute is the same escalation as lifting it.
  private static async checkExistingMute(
    target: GuildMember,
    moderator: GuildMember,
    tier: ModeratorTier,
  ): Promise<{ record: MuteRecord | undefined; error?: string }> {
    const [record] = await db
      .select()
      .from(memberMute)
      .where(
        and(
          eq(memberMute.memberId, target.id),
          eq(memberMute.guildId, target.guild.id),
          isNull(memberMute.liftedAt),
        ),
      )
      .orderBy(desc(memberMute.createdAt))
      .limit(1);

    if (tier === "staff") return { record };

    // A timeout the bot has no record of was set in the Discord UI, which only
    // staff can do, so an unknown mute is treated as a staff mute.
    if (!record)
      return {
        record,
        error: "That mute was not set through this bot, so only staff can change it.",
      };

    if (record.moderatorTier !== "helper")
      return { record, error: "Only staff can change a mute set by staff." };

    if (record.moderatorId !== moderator.id)
      return { record, error: "You can only change a mute you set yourself." };

    return { record };
  }

  static async mute(params: {
    target: GuildMember;
    moderator: GuildMember;
    minutes: number;
    reason: string | undefined;
  }): Promise<MuteResult> {
    const tier = this.resolveTier(params.moderator);
    if (!tier) return { ok: false, error: "You are not allowed to use this command." };

    if (params.target.id === params.moderator.id)
      return { ok: false, error: "You cannot mute yourself." };

    if (params.target.user.bot)
      return { ok: false, error: "You cannot mute a bot." };

    if (this.isStaff(params.target))
      return { ok: false, error: "You cannot mute a staff member." };

    if (tier === "helper" && this.isHelper(params.target))
      return { ok: false, error: "Helpers cannot mute other helpers." };

    const limit = MUTE_LIMIT_MINUTES[tier];
    if (params.minutes > limit) {
      return {
        ok: false,
        error: `Your role can mute for at most ${formatDuration(limit)}.`,
      };
    }

    if (!params.target.moderatable) {
      return {
        ok: false,
        error: "I cannot time out that member. My role must sit above theirs.",
      };
    }

    if (params.target.isCommunicationDisabled()) {
      const existing = await this.checkExistingMute(params.target, params.moderator, tier);
      if (existing.error) return { ok: false, error: existing.error };
    }

    const expiresAt = new Date(Date.now() + params.minutes * 60_000);
    const reason = `${params.reason ?? "No reason provided"} (by ${params.moderator.user.username})`;

    await params.target.timeout(params.minutes * 60_000, reason);

    // Written after the timeout lands so a record never claims a mute that failed.
    await db.insert(memberMute).values({
      memberId: params.target.id,
      guildId: params.target.guild.id,
      moderatorId: params.moderator.id,
      moderatorTier: tier,
      reason: params.reason ?? null,
      expiresAt: expiresAt.toISOString(),
    });

    await ModLogService.postLog({
      guild: params.target.guild,
      action: "timeout",
      targetId: params.target.id,
      targetName: params.target.user.username,
      targetUser: params.target.user,
      moderatorId: params.moderator.id,
      moderatorName: params.moderator.user.username,
      reason: `${params.reason ?? "No reason provided"} (${formatDuration(params.minutes)}, until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>)`,
    });

    return {
      ok: true,
      message: `Muted <@${params.target.id}> for ${formatDuration(params.minutes)}.`,
    };
  }

  static async unmute(params: {
    target: GuildMember;
    moderator: GuildMember;
  }): Promise<MuteResult> {
    const tier = this.resolveTier(params.moderator);
    if (!tier) return { ok: false, error: "You are not allowed to use this command." };

    if (!params.target.isCommunicationDisabled())
      return { ok: false, error: "That member is not muted." };

    const existing = await this.checkExistingMute(params.target, params.moderator, tier);
    if (existing.error) return { ok: false, error: existing.error };
    const record = existing.record;

    if (!params.target.moderatable)
      return { ok: false, error: "I cannot lift that timeout. My role must sit above theirs." };

    await params.target.timeout(null, `Unmuted by ${params.moderator.user.username}`);

    if (record) {
      await db
        .update(memberMute)
        .set({
          liftedAt: new Date().toISOString(),
          liftedByMemberId: params.moderator.id,
        })
        .where(eq(memberMute.id, record.id));
    }

    await ModLogService.postLog({
      guild: params.target.guild,
      action: "untimeout",
      targetId: params.target.id,
      targetName: params.target.user.username,
      targetUser: params.target.user,
      moderatorId: params.moderator.id,
      moderatorName: params.moderator.user.username,
    });

    return { ok: true, message: `Unmuted <@${params.target.id}>.` };
  }
}
