import { db } from "@/lib/db";
import {
  memberDeletedMessages,
  memberGuild,
  memberMessages,
  threadMessage,
} from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";

type OptOutFlags = { messageOptOut: boolean; presenceOptOut: boolean };

const NO_OPT_OUT: OptOutFlags = {
  messageOptOut: false,
  presenceOptOut: false,
};

export class PrivacyService {
  // memberId:guildId -> flags. Keeps the message-create hot path off the DB.
  private static cache = new Map<string, OptOutFlags>();

  private static key(memberId: string, guildId: string) {
    return `${memberId}:${guildId}`;
  }

  static async getFlags(
    memberId: string,
    guildId: string,
  ): Promise<OptOutFlags> {
    const cached = this.cache.get(this.key(memberId, guildId));
    if (cached) return cached;

    const row = await db.query.memberGuild.findFirst({
      where: and(
        eq(memberGuild.memberId, memberId),
        eq(memberGuild.guildId, guildId),
      ),
      columns: { messageOptOut: true, presenceOptOut: true },
    });

    const flags: OptOutFlags = row
      ? {
          messageOptOut: row.messageOptOut,
          presenceOptOut: row.presenceOptOut,
        }
      : NO_OPT_OUT;

    this.cache.set(this.key(memberId, guildId), flags);
    return flags;
  }

  static async hasMessageOptOut(
    memberId: string,
    guildId: string,
  ): Promise<boolean> {
    return (await this.getFlags(memberId, guildId)).messageOptOut;
  }

  static async hasPresenceOptOut(
    memberId: string,
    guildId: string,
  ): Promise<boolean> {
    return (await this.getFlags(memberId, guildId)).presenceOptOut;
  }

  static invalidate(memberId: string, guildId: string) {
    this.cache.delete(this.key(memberId, guildId));
  }

  static async setMessageOptOut(
    memberId: string,
    guildId: string,
    optOut: boolean,
  ): Promise<void> {
    await db
      .update(memberGuild)
      .set({ messageOptOut: optOut })
      .where(
        and(
          eq(memberGuild.memberId, memberId),
          eq(memberGuild.guildId, guildId),
        ),
      );
    this.invalidate(memberId, guildId);
    if (optOut) await this.purgeMessageData(memberId, guildId);
  }

  static async setPresenceOptOut(
    memberId: string,
    guildId: string,
    optOut: boolean,
  ): Promise<void> {
    await db
      .update(memberGuild)
      .set({ presenceOptOut: optOut })
      .where(
        and(
          eq(memberGuild.memberId, memberId),
          eq(memberGuild.guildId, guildId),
        ),
      );
    this.invalidate(memberId, guildId);
    if (optOut) await this.purgePresenceData(memberId, guildId);
  }

  // Removes stored message content for the member in this guild.
  static async purgeMessageData(
    memberId: string,
    guildId: string,
  ): Promise<void> {
    await Promise.all([
      db
        .delete(memberMessages)
        .where(
          and(
            eq(memberMessages.memberId, memberId),
            eq(memberMessages.guildId, guildId),
          ),
        ),
      db
        .delete(memberDeletedMessages)
        .where(
          and(
            eq(memberDeletedMessages.messageMemberId, memberId),
            eq(memberDeletedMessages.guildId, guildId),
          ),
        ),
      db
        .delete(threadMessage)
        .where(
          and(
            eq(threadMessage.authorId, memberId),
            eq(threadMessage.guildId, guildId),
          ),
        ),
    ]);
  }

  // Clears stored presence fields for the member in this guild.
  static async purgePresenceData(
    memberId: string,
    guildId: string,
  ): Promise<void> {
    await db
      .update(memberGuild)
      .set({
        presenceStatus: null,
        presenceActivity: null,
        presenceUpdatedAt: null,
      })
      .where(
        and(
          eq(memberGuild.memberId, memberId),
          eq(memberGuild.guildId, guildId),
        ),
      );
  }
}
