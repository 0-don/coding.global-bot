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

  // Rank follows the server's role order, so reordering roles in Discord is all
  // it takes to change who may override whose timeout.
  private static rank(member: GuildMember): number {
    return member.id === member.guild.ownerId
      ? Number.POSITIVE_INFINITY
      : member.roles.highest.position;
  }

  private static async activeMute(
    target: GuildMember,
  ): Promise<MuteRecord | undefined> {
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
    return record;
  }

  // The member who set a timeout, when they rank at or above `actorId` and so
  // may only be overridden by someone higher. Null when the change is allowed,
  // including when the setter has left and there is no rank left to protect.
  private static async outrankingSetter(
    target: GuildMember,
    record: MuteRecord,
    actorId: string,
  ): Promise<GuildMember | null> {
    if (record.moderatorId === actorId) return null;

    const [setter, actor] = await Promise.all([
      target.guild.members.fetch(record.moderatorId).catch(() => null),
      target.guild.members.fetch(actorId).catch(() => null),
    ]);
    if (!setter || !actor) return null;

    return this.rank(setter) >= this.rank(actor) ? setter : null;
  }

  // A new timeout replaces the old one, so every open record for the member is
  // closed; otherwise a stale one would be read as the active timeout later.
  private static async closeOpenMutes(target: GuildMember, liftedById: string) {
    await db
      .update(memberMute)
      .set({
        liftedAt: new Date().toISOString(),
        liftedByMemberId: liftedById,
      })
      .where(
        and(
          eq(memberMute.memberId, target.id),
          eq(memberMute.guildId, target.guild.id),
          isNull(memberMute.liftedAt),
        ),
      );
  }

  // Discord's timeout is a single value, so re-muting a member REPLACES the
  // standing timeout: shortening a mute is the same override as lifting it.
  private static async checkExistingMute(
    target: GuildMember,
    moderator: GuildMember,
    tier: ModeratorTier,
  ): Promise<{ record: MuteRecord | undefined; error?: string }> {
    const record = await this.activeMute(target);

    // A timeout with no record predates menu tracking; the Discord menu needs
    // Moderate Members, which only staff hold, so treat it as a staff mute.
    if (!record)
      return tier === "staff"
        ? { record }
        : {
            record,
            error: "That timeout was not set through this bot, so only staff can change it.",
          };

    if (tier === "helper" && record.moderatorTier !== "helper")
      return { record, error: "Only staff can change a timeout set by staff." };

    const setter = await this.outrankingSetter(target, record, moderator.id);
    if (setter)
      return {
        record,
        error: `That timeout was set by ${setter.user.username}, who ranks at or above you, so only someone higher can change it.`,
      };

    return { record };
  }

  /**
   * A timeout set or lifted in Discord's own menu skips /timeout's rank check.
   * It is allowed, but recorded so the next change knows who set it. Returns
   * the setter of the timeout it replaced when they outrank the actor, so the
   * mod log can flag the override.
   */
  static async recordMenuChange(params: {
    target: GuildMember;
    actorId: string;
    expiresAt: number | null;
    reason: string | undefined;
  }): Promise<GuildMember | null> {
    const record = await this.activeMute(params.target);
    const setter = record
      ? await this.outrankingSetter(params.target, record, params.actorId)
      : null;

    await this.closeOpenMutes(params.target, params.actorId);

    if (params.expiresAt !== null) {
      const actor = await params.target.guild.members
        .fetch(params.actorId)
        .catch(() => null);
      await db.insert(memberMute).values({
        memberId: params.target.id,
        guildId: params.target.guild.id,
        moderatorId: params.actorId,
        moderatorTier: (actor && this.resolveTier(actor)) ?? "staff",
        reason: params.reason ?? null,
        expiresAt: new Date(params.expiresAt).toISOString(),
      });
    }

    return setter;
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
      return { ok: false, error: "You cannot time out yourself." };

    if (params.target.user.bot)
      return { ok: false, error: "You cannot time out a bot." };

    if (this.isStaff(params.target))
      return { ok: false, error: "You cannot time out a staff member." };

    if (tier === "helper" && this.isHelper(params.target))
      return { ok: false, error: "Helpers cannot time out other helpers." };

    const limit = MUTE_LIMIT_MINUTES[tier];
    if (params.minutes > limit) {
      return {
        ok: false,
        error: `Your role can time out for at most ${formatDuration(limit)}.`,
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
    await this.closeOpenMutes(params.target, params.moderator.id);
    await db.insert(memberMute).values({
      memberId: params.target.id,
      guildId: params.target.guild.id,
      moderatorId: params.moderator.id,
      moderatorTier: tier,
      reason: params.reason ?? null,
      expiresAt: expiresAt.toISOString(),
    });

    await ModLogService.record(params.target.guild, {
      action: "User Timed Out",
      targetId: params.target.id,
      moderatorId: params.moderator.id,
      reason: `${params.reason ?? "No reason provided"} (${formatDuration(params.minutes)})`,
    });

    return {
      ok: true,
      message: `Timed out <@${params.target.id}> for ${formatDuration(params.minutes)}.`,
    };
  }

  static async unmute(params: {
    target: GuildMember;
    moderator: GuildMember;
  }): Promise<MuteResult> {
    const tier = this.resolveTier(params.moderator);
    if (!tier) return { ok: false, error: "You are not allowed to use this command." };

    if (!params.target.isCommunicationDisabled())
      return { ok: false, error: "That member is not timed out." };

    const existing = await this.checkExistingMute(params.target, params.moderator, tier);
    if (existing.error) return { ok: false, error: existing.error };

    if (!params.target.moderatable)
      return { ok: false, error: "I cannot lift that timeout. My role must sit above theirs." };

    await params.target.timeout(null, `Timeout removed by ${params.moderator.user.username}`);

    await ModLogService.record(params.target.guild, {
      action: "User Untimed Out",
      targetId: params.target.id,
      moderatorId: params.moderator.id,
    });

    await this.closeOpenMutes(params.target, params.moderator.id);

    return { ok: true, message: `Removed the timeout from <@${params.target.id}>.` };
  }
}
