import { createHash } from "crypto";
import { Attachment, Message } from "discord.js";
import { prisma } from "../../prisma";
import { deleteUserMessages } from "../messages/delete-user-messages";

const DUPLICATE_WARNING_THRESHOLD = 3; // Start warning at 3rd duplicate
const DUPLICATE_JAIL_THRESHOLD = 4; // Jail at 4th duplicate
const CHANNEL_WARNING_THRESHOLD = 8; // Start warning at 8th channel
const CHANNEL_JAIL_THRESHOLD = 10; // Jail at 10th channel
const CHANNEL_SPAM_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface UserState {
  // Duplicate detection
  count: number;
  lastContent: string;
  lastAttachmentHashes: string[];
  // Channel spam detection
  recentChannels: Array<{ channelId: string; timestamp: number }>;
}

const userStates = new Map<string, UserState>();

/**
 * Downloads attachment and creates a hash of its content.
 * Falls back to metadata hash if download fails.
 */
async function hashAttachmentContent(attachment: Attachment): Promise<string> {
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error("Failed to fetch");

    const buffer = await response.arrayBuffer();
    return createHash("sha256")
      .update(Buffer.from(buffer))
      .digest("hex")
      .slice(0, 32);
  } catch {
    // Fallback to metadata hash if download fails
    const baseUrl = attachment.proxyURL.split("?")[0];
    return createHash("sha256")
      .update(`${attachment.size}|${attachment.name}|${baseUrl}`)
      .digest("hex")
      .slice(0, 32);
  }
}

/**
 * Checks if two sets of attachment hashes are similar.
 * Returns true if all hashes match (order-independent).
 */
function areAttachmentsSimilar(
  hashes1: string[],
  hashes2: string[],
): boolean {
  if (hashes1.length !== hashes2.length) return false;
  if (hashes1.length === 0) return true;

  const sorted1 = [...hashes1].sort();
  const sorted2 = [...hashes2].sort();

  return sorted1.every((hash, i) => hash === sorted2[i]);
}

/**
 * Checks for duplicate spam messages.
 * Uses fuzzy matching for text and content hashing for attachments.
 * Triggers when a user sends similar messages 5 times in a row.
 */
export async function checkDuplicateSpam(message: Message): Promise<boolean> {
  if (message.author.bot) return false;

  const content = message.content.trim();
  const attachments = Array.from(message.attachments.values());

  // Skip empty messages
  if (!content && attachments.length === 0) return false;

  // Hash all attachments by content
  const attachmentHashes = await Promise.all(
    attachments.map(hashAttachmentContent),
  );

  const userId = message.author.id;

  const state = userStates.get(userId);
  const now = Date.now();
  const channelId = message.channel.id;

  // Check if message matches previous (duplicate detection)
  const textMatches = state ? content === state.lastContent : false;
  const attachmentsMatch = state
    ? areAttachmentsSimilar(attachmentHashes, state.lastAttachmentHashes)
    : false;

  const isDuplicate = textMatches && attachmentsMatch;

  let count = 1;
  if (isDuplicate && state) {
    count = state.count + 1;
  }

  // Track channels (prune old entries, add current)
  let recentChannels = state?.recentChannels ?? [];
  recentChannels = recentChannels.filter(
    (c) => now - c.timestamp < CHANNEL_SPAM_WINDOW_MS,
  );

  // Only add if this is a different channel than the last entry
  const lastChannel = recentChannels[recentChannels.length - 1];
  if (!lastChannel || lastChannel.channelId !== channelId) {
    recentChannels.push({ channelId, timestamp: now });
  }

  // Count unique channels in window
  const uniqueChannels = new Set(recentChannels.map((c) => c.channelId)).size;

  userStates.set(userId, {
    count,
    lastContent: content,
    lastAttachmentHashes: attachmentHashes,
    recentChannels,
  });

  // Check for duplicate spam warning/jail thresholds
  const shouldWarnDuplicate = count >= DUPLICATE_WARNING_THRESHOLD;
  const shouldJailDuplicate = count >= DUPLICATE_JAIL_THRESHOLD;

  // Check for channel spam warning/jail thresholds
  const shouldWarnChannelSpam = uniqueChannels >= CHANNEL_WARNING_THRESHOLD;
  const shouldJailChannelSpam = uniqueChannels >= CHANNEL_JAIL_THRESHOLD;

  // Handle duplicate message spam
  if (shouldWarnDuplicate || shouldJailDuplicate) {
    if (!message.guild) return false;

    // Delete the spam message
    await message.delete().catch(() => {});

    if (shouldJailDuplicate) {
      const reason = `Sent ${count} duplicate messages`;

      await deleteUserMessages({
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild,
        reason,
      });

      try {
        await message.author.send("You have been muted. Ask a mod to unmute you.");
      } catch (error) {
        // User has DMs disabled, ignore
      }

      userStates.delete(userId);
    } else {
      // Send warning
      const warningMessage = `Stop posting duplicate messages. This is warning ${count - DUPLICATE_WARNING_THRESHOLD + 1}, you will be muted at ${DUPLICATE_JAIL_THRESHOLD - DUPLICATE_WARNING_THRESHOLD + 1} warnings.`;

      try {
        await message.author.send(warningMessage);
      } catch (error) {
        // User has DMs disabled, ignore
      }
    }

    return true;
  }

  // Handle channel spam
  if (shouldWarnChannelSpam || shouldJailChannelSpam) {
    if (!message.guild) return false;

    // Delete the spam message
    await message.delete().catch(() => {});

    if (shouldJailChannelSpam) {
      const reason = `Posted in ${uniqueChannels} channels within 10 minutes`;

      await deleteUserMessages({
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild,
        reason,
      });

      try {
        await message.author.send("You have been muted. Ask a mod to unmute you.");
      } catch (error) {
        // User has DMs disabled, ignore
      }

      userStates.delete(userId);
    } else {
      // Send warning
      const warningMessage = `Stop posting in multiple channels rapidly. This is warning ${uniqueChannels - CHANNEL_WARNING_THRESHOLD + 1}, you will be muted at ${CHANNEL_JAIL_THRESHOLD - CHANNEL_WARNING_THRESHOLD + 1} warnings.`;

      try {
        await message.author.send(warningMessage);
      } catch (error) {
        // User has DMs disabled, ignore
      }
    }

    return true;
  }

  return false;
}
