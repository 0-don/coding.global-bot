import { bot } from "@/main";
import { prisma } from "@/prisma";
import { mapAttachmentToDb } from "@/shared/mappers/discord.mapper";
import { error, log } from "console";
import type { TextChannel, ThreadChannel } from "discord.js";

// Check every 5 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
// Refresh attachments expiring within 6 hours
const EXPIRY_THRESHOLD_MS = 6 * 60 * 60 * 1000;
// Process up to 10 messages per cycle
const BATCH_SIZE = 10;

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

      // Find messages with attachments expiring soon
      const expiringAttachments = await prisma.attachment.findMany({
        where: {
          expiresAt: {
            lt: threshold,
            gt: new Date(), // Not already expired
          },
        },
        select: {
          messageId: true,
          message: {
            select: {
              threadId: true,
              thread: {
                select: {
                  guildId: true,
                },
              },
            },
          },
        },
        distinct: ["messageId"],
        take: BATCH_SIZE,
      });

      if (expiringAttachments.length === 0) return;

      log(`Refreshing ${expiringAttachments.length} messages with expiring attachments`);

      for (const attachment of expiringAttachments) {
        await this.refreshMessageAttachments(
          attachment.message.thread.guildId,
          attachment.message.threadId,
          attachment.messageId,
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

      const channel = guild.channels.cache.get(threadId) as ThreadChannel | TextChannel | undefined;
      if (!channel || !("messages" in channel)) return;

      const message = await channel.messages.fetch(messageId);
      if (!message) {
        // Message was deleted, remove attachments
        await prisma.attachment.deleteMany({ where: { messageId } });
        return;
      }

      const attachments = Array.from(message.attachments.values());

      if (attachments.length === 0) {
        await prisma.attachment.deleteMany({ where: { messageId } });
        return;
      }

      const attachmentData = attachments.map((a) => mapAttachmentToDb(a, messageId));

      await prisma.$transaction([
        prisma.attachment.deleteMany({ where: { messageId } }),
        prisma.attachment.createMany({ data: attachmentData }),
      ]);

      log(`Refreshed attachments for message ${messageId}`);
    } catch (err) {
      error(`Failed to refresh attachments for message ${messageId}:`, err);
    }
  }
}
