import { UNKNOWN_CHANNEL, UNKNOWN_MESSAGE } from "@/core/utils/command.utils";
import { bot } from "@/main";
import { db } from "@/lib/db";
import { attachment } from "@/lib/db-schema";
import { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
import { mapAttachmentToDb } from "@/shared/mappers/discord.mapper";
import { error, log } from "console";
import { DiscordAPIError, HTTPError, type TextChannel, type ThreadChannel } from "discord.js";

// Check every 10 second
const CHECK_INTERVAL_MS = 10000;
// Refresh attachments expiring within 6 hours
const EXPIRY_THRESHOLD_MS = 6 * 60 * 60 * 1000;
// Process up to 10 messages per cycle
const BATCH_SIZE = 10;
// Max failed refresh attempts before deleting
const MAX_REFRESH_ATTEMPTS = 5;

export class AttachmentRefreshQueueService {
  private static interval: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static start() {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.processExpiringAttachments().catch((err) => {
        error("Attachment refresh error:", err);
      });
    }, CHECK_INTERVAL_MS);

    log("Attachment refresh queue started");
  }

  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      log("Attachment refresh queue stopped");
    }
  }

  private static async processExpiringAttachments() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const threshold = new Date(Date.now() + EXPIRY_THRESHOLD_MS);

      // Find messages with attachments expiring soon or already expired, prioritizing soonest/already expired
      const expiringAttachments = await db.query.attachment.findMany({
        where: lt(attachment.expiresAt, threshold.toISOString()),
        with: {
          threadMessage: {
            with: {
              thread: {
                columns: { guildId: true },
              },
            },
            columns: { threadId: true },
          },
        },
        columns: { messageId: true },
        orderBy: asc(attachment.expiresAt),
        limit: BATCH_SIZE,
      });

      // Get distinct messageIds
      const seen = new Set<string>();
      const uniqueAttachments = expiringAttachments.filter((a) => {
        if (seen.has(a.messageId)) return false;
        seen.add(a.messageId);
        return true;
      });

      if (uniqueAttachments.length === 0) return;

      for (const att of uniqueAttachments) {
        if (!att.threadMessage?.thread) continue;
        await this.refreshMessageAttachments(
          att.threadMessage.thread.guildId,
          att.threadMessage.threadId,
          att.messageId,
        );
      }
    } catch (err) {
      error("Failed to process expiring attachments:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  private static async refreshMessageAttachments(
    guildId: string,
    threadId: string,
    messageId: string,
  ) {
    try {
      const guild = bot.guilds.cache.get(guildId);
      if (!guild) return;

      // Try cache first, then fetch from API (threads may not be cached if archived)
      let channel = guild.channels.cache.get(threadId) as
        | ThreadChannel
        | TextChannel
        | undefined;

      if (!channel) {
        try {
          const fetched = await guild.channels.fetch(threadId);
          if (fetched && "messages" in fetched) {
            channel = fetched as ThreadChannel | TextChannel;
          }
        } catch {
          // Channel doesn't exist anymore
        }
      }

      if (!channel || !("messages" in channel)) {
        // Channel no longer exists, clean up attachments
        await db.delete(attachment).where(eq(attachment.messageId, messageId));
        return;
      }

      const message = await channel.messages.fetch(messageId);
      if (!message) {
        // Message was deleted, remove attachments
        await db.delete(attachment).where(eq(attachment.messageId, messageId));
        return;
      }

      const attachments = Array.from(message.attachments.values());

      if (attachments.length === 0) {
        await db.delete(attachment).where(eq(attachment.messageId, messageId));
        return;
      }

      const attachmentData = attachments.map((a) =>
        mapAttachmentToDb(a, messageId),
      );

      await db.transaction(async (tx) => {
        await tx.delete(attachment).where(eq(attachment.messageId, messageId));
        await tx.insert(attachment).values(attachmentData);
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      // If channel or message no longer exists, clean up the attachments from DB
      if (code === UNKNOWN_CHANNEL || code === UNKNOWN_MESSAGE) {
        await db.delete(attachment)
          .where(eq(attachment.messageId, messageId))
          .catch(() => {});
        log(`Cleaned up attachments for deleted message/channel ${messageId}`);
        return;
      }

      // Handle Discord API 5xx errors (transient server issues)
      const status = (err as HTTPError | DiscordAPIError).status;
      if (status && status >= 500 && status < 600) {
        await this.incrementFailedAttempts(messageId);
        return;
      }

      error(`Failed to refresh attachments for message ${messageId}:`, err);
    }
  }

  private static async incrementFailedAttempts(messageId: string) {
    // Increment failed attempts counter
    const updated = await db.update(attachment)
      .set({ failedRefreshAttempts: sql`${attachment.failedRefreshAttempts} + 1` })
      .where(eq(attachment.messageId, messageId));

    // Check if any attachment has exceeded max attempts
    const maxAttempts = await db.query.attachment.findFirst({
      where: and(
        eq(attachment.messageId, messageId),
        gte(attachment.failedRefreshAttempts, MAX_REFRESH_ATTEMPTS),
      ),
    });

    if (maxAttempts) {
      await db.delete(attachment).where(eq(attachment.messageId, messageId));
      log(`Deleted attachments for message ${messageId} after ${MAX_REFRESH_ATTEMPTS} failed refresh attempts`);
    }
  }
}
