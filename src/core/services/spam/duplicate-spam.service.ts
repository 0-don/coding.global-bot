import { createHash } from "crypto";
import { Attachment, Message } from "discord.js";
import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import {
  CHANNEL_JAIL_THRESHOLD,
  CHANNEL_SPAM_WINDOW_MS,
  CHANNEL_WARNING_THRESHOLD,
  DUPLICATE_JAIL_THRESHOLD,
  DUPLICATE_WARNING_THRESHOLD,
} from "@/shared/config/spam";
import type { UserSpamState } from "@/types";

export class DuplicateSpamService {
  private static userStates = new Map<string, UserSpamState>();

  static async checkDuplicateSpam(message: Message): Promise<boolean> {
    if (message.author.bot) return false;

    const content = message.content.trim();
    const attachments = Array.from(message.attachments.values());

    if (!content && attachments.length === 0) return false;

    const attachmentHashes = await Promise.all(
      attachments.map((a) => this.hashAttachmentContent(a)),
    );

    const userId = message.author.id;
    const state = this.userStates.get(userId);
    const now = Date.now();
    const channelId = message.channel.id;

    const textMatches = state ? content === state.lastContent : false;
    const attachmentsMatch = state
      ? this.areAttachmentsSimilar(attachmentHashes, state.lastAttachmentHashes)
      : false;

    const isDuplicate = textMatches && attachmentsMatch;

    let count = 1;
    if (isDuplicate && state) {
      count = state.count + 1;
    }

    let recentChannels = state?.recentChannels ?? [];
    recentChannels = recentChannels.filter(
      (c) => now - c.timestamp < CHANNEL_SPAM_WINDOW_MS,
    );

    const lastChannel = recentChannels[recentChannels.length - 1];
    if (!lastChannel || lastChannel.channelId !== channelId) {
      recentChannels.push({ channelId, timestamp: now });
    }

    const uniqueChannels = new Set(recentChannels.map((c) => c.channelId)).size;

    this.userStates.set(userId, {
      count,
      lastContent: content,
      lastAttachmentHashes: attachmentHashes,
      recentChannels,
    });

    const shouldWarnDuplicate = count >= DUPLICATE_WARNING_THRESHOLD;
    const shouldJailDuplicate = count >= DUPLICATE_JAIL_THRESHOLD;
    const shouldWarnChannelSpam = uniqueChannels >= CHANNEL_WARNING_THRESHOLD;
    const shouldJailChannelSpam = uniqueChannels >= CHANNEL_JAIL_THRESHOLD;

    if (shouldWarnDuplicate || shouldJailDuplicate) {
      return this.handleDuplicateSpam(
        message,
        userId,
        count,
        shouldJailDuplicate,
      );
    }

    if (shouldWarnChannelSpam || shouldJailChannelSpam) {
      return this.handleChannelSpam(
        message,
        userId,
        uniqueChannels,
        shouldJailChannelSpam,
      );
    }

    return false;
  }

  private static async handleDuplicateSpam(
    message: Message,
    userId: string,
    count: number,
    shouldJail: boolean,
  ): Promise<boolean> {
    if (!message.guild) return false;

    await message.delete().catch(() => {});

    if (shouldJail) {
      const reason = `Sent ${count} duplicate messages`;

      await DeleteUserMessagesService.deleteUserMessages({
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild,
        reason,
      });

      try {
        await message.author.send(
          "You have been muted. Ask a mod to unmute you.",
        );
      } catch {
        // User has DMs disabled
      }

      this.userStates.delete(userId);
    } else {
      const warningMessage = `Stop posting duplicate messages. This is warning ${count - DUPLICATE_WARNING_THRESHOLD + 1}, you will be muted at ${DUPLICATE_JAIL_THRESHOLD - DUPLICATE_WARNING_THRESHOLD + 1} warnings.`;

      try {
        await message.author.send(warningMessage);
      } catch {
        // User has DMs disabled
      }
    }

    return true;
  }

  private static async handleChannelSpam(
    message: Message,
    userId: string,
    uniqueChannels: number,
    shouldJail: boolean,
  ): Promise<boolean> {
    if (!message.guild) return false;

    await message.delete().catch(() => {});

    if (shouldJail) {
      const reason = `Posted in ${uniqueChannels} channels within 10 minutes`;

      await DeleteUserMessagesService.deleteUserMessages({
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild,
        reason,
      });

      try {
        await message.author.send(
          "You have been muted. Ask a mod to unmute you.",
        );
      } catch {
        // User has DMs disabled
      }

      this.userStates.delete(userId);
    } else {
      const warningMessage = `Stop posting in multiple channels rapidly. This is warning ${uniqueChannels - CHANNEL_WARNING_THRESHOLD + 1}, you will be muted at ${CHANNEL_JAIL_THRESHOLD - CHANNEL_WARNING_THRESHOLD + 1} warnings.`;

      try {
        await message.author.send(warningMessage);
      } catch {
        // User has DMs disabled
      }
    }

    return true;
  }

  private static async hashAttachmentContent(
    attachment: Attachment,
  ): Promise<string> {
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error("Failed to fetch");

      const buffer = await response.arrayBuffer();
      return createHash("sha256")
        .update(Buffer.from(buffer))
        .digest("hex")
        .slice(0, 32);
    } catch {
      const baseUrl = attachment.proxyURL.split("?")[0];
      return createHash("sha256")
        .update(`${attachment.size}|${attachment.name}|${baseUrl}`)
        .digest("hex")
        .slice(0, 32);
    }
  }

  private static areAttachmentsSimilar(
    hashes1: string[],
    hashes2: string[],
  ): boolean {
    if (hashes1.length !== hashes2.length) return false;
    if (hashes1.length === 0) return true;

    const sorted1 = [...hashes1].sort();
    const sorted2 = [...hashes2].sort();

    return sorted1.every((hash, i) => hash === sorted2[i]);
  }
}
