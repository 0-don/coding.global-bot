import {
  ChannelType,
  ForumChannel,
  GuildForumTag,
  Message,
  ThreadChannel,
} from "discord.js";
import { prisma } from "@/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  mapAttachment,
  mapEmbed,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";

export class ThreadService {
  // ============================================
  // Thread Operations
  // ============================================

  static async upsertThread(
    thread: ThreadChannel,
    boardType: string,
  ): Promise<void> {
    const guildId = thread.guildId;
    const authorId = thread.ownerId;

    if (!guildId || !authorId) return;

    // Fetch starter message for content and image
    let content: string | null = null;
    let imageUrl: string | null = null;

    try {
      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage) {
        content = starterMessage.content || null;
        const imageAttachment = starterMessage.attachments.find((attachment) =>
          attachment.contentType?.startsWith("image/"),
        );
        imageUrl = imageAttachment?.url || null;
      }
    } catch (_) {}

    const threadData: Prisma.ThreadUpsertArgs["create"] = {
      id: thread.id,
      guildId,
      parentId: thread.parentId,
      authorId,
      name: thread.name,
      boardType,
      content,
      imageUrl,
      messageCount: thread.messageCount || 0,
      memberCount: thread.memberCount || 0,
      locked: !!thread.locked,
      archived: !!thread.archived,
      archivedAt: thread.archiveTimestamp
        ? new Date(thread.archiveTimestamp)
        : null,
      autoArchiveDuration: thread.autoArchiveDuration || null,
      invitable: thread.invitable,
      rateLimitPerUser: thread.rateLimitPerUser,
      flags: thread.flags.bitfield,
      createdAt: thread.createdAt,
    };

    try {
      await prisma.thread.upsert({
        where: { id: thread.id },
        create: threadData,
        update: {
          name: threadData.name,
          content: threadData.content,
          imageUrl: threadData.imageUrl,
          messageCount: threadData.messageCount,
          memberCount: threadData.memberCount,
          locked: threadData.locked,
          archived: threadData.archived,
          archivedAt: threadData.archivedAt,
          autoArchiveDuration: threadData.autoArchiveDuration,
          invitable: threadData.invitable,
          rateLimitPerUser: threadData.rateLimitPerUser,
          flags: threadData.flags,
        },
      });

      // Sync tags if parent is a forum channel
      if (thread.parent?.type === ChannelType.GuildForum) {
        await this.syncThreadTags(thread.id, thread.appliedTags);
      }
    } catch (_) {}
  }

  static async deleteThread(threadId: string): Promise<void> {
    try {
      await prisma.thread.delete({
        where: { id: threadId },
      });
    } catch (_) {}
  }

  static async getThread(threadId: string) {
    return prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        author: {
          include: {
            guilds: true,
            roles: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  static async getThreadsByBoard(guildId: string, boardType: string) {
    return prisma.thread.findMany({
      where: {
        guildId,
        boardType,
      },
      include: {
        author: {
          include: {
            guilds: {
              where: { guildId },
            },
            roles: {
              where: { guildId },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // ============================================
  // Reply Operations (Thread Messages)
  // ============================================

  static async upsertReply(message: Message): Promise<void> {
    const channel = message.channel;

    // Only handle messages in threads
    if (!channel.isThread()) return;

    const threadId = channel.id;
    const guildId = message.guildId;
    const authorId = message.author.id;

    if (!guildId || !authorId) return;

    // Check if thread exists in database
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    // Skip if thread is not tracked
    if (!thread) return;

    const replyData = this.parseReplyToDb(message, threadId, guildId);

    try {
      await prisma.threadReply.upsert({
        where: { id: message.id },
        create: replyData,
        update: {
          content: replyData.content,
          editedAt: replyData.editedAt,
          pinned: replyData.pinned,
          attachments: replyData.attachments,
          embeds: replyData.embeds,
          mentions: replyData.mentions,
          reactions: replyData.reactions,
          reference: replyData.reference,
        },
      });
    } catch (_) {}
  }

  static async deleteReply(messageId: string): Promise<void> {
    try {
      await prisma.threadReply.delete({
        where: { id: messageId },
      });
    } catch (_) {}
  }

  static async getReplies(
    threadId: string,
    options: { after?: string; limit?: number } = {},
  ) {
    const limit = options.limit || 50;

    const replies = await prisma.threadReply.findMany({
      where: {
        threadId,
        ...(options.after && {
          id: { gt: options.after },
        }),
      },
      include: {
        author: {
          include: {
            guilds: true,
            roles: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit + 1, // Fetch one extra to check if there are more
    });

    const hasMore = replies.length > limit;
    const messages = hasMore ? replies.slice(0, limit) : replies;

    return {
      messages,
      hasMore,
      nextCursor: messages[messages.length - 1]?.id ?? null,
    };
  }

  // ============================================
  // Tag Operations
  // ============================================

  static async upsertTags(
    guildId: string,
    tags: GuildForumTag[],
  ): Promise<void> {
    for (const tag of tags) {
      try {
        await prisma.tag.upsert({
          where: { id: tag.id },
          create: {
            id: tag.id,
            guildId,
            name: tag.name,
            emojiId: tag.emoji?.id || null,
            emojiName: tag.emoji?.name || null,
          },
          update: {
            name: tag.name,
            emojiId: tag.emoji?.id || null,
            emojiName: tag.emoji?.name || null,
          },
        });
      } catch (_) {}
    }
  }

  static async syncThreadTags(
    threadId: string,
    tagIds: string[],
  ): Promise<void> {
    try {
      // Remove old tags
      await prisma.threadTag.deleteMany({
        where: { threadId },
      });

      // Add new tags
      if (tagIds.length > 0) {
        await prisma.threadTag.createMany({
          data: tagIds.map((tagId) => ({
            threadId,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    } catch (_) {}
  }

  // ============================================
  // Parsing Helpers
  // ============================================

  static parseReplyToDb(
    message: Message,
    threadId: string,
    guildId: string,
  ): Prisma.ThreadReplyCreateInput {
    return {
      id: message.id,
      thread: { connect: { id: threadId } },
      author: { connect: { memberId: message.author.id } },
      guild: { connect: { guildId } },
      content: message.content,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      pinned: message.pinned,
      tts: message.tts,
      type: message.type.toString(),
      attachments: Array.from(message.attachments.values()).map(mapAttachment),
      embeds: message.embeds.map(mapEmbed),
      mentions: mapMentions(message.mentions),
      reactions: mapReactions(message.reactions.cache.values()),
      reference: mapReference(message.reference) ?? undefined,
    };
  }

  static getBoardTypeFromChannel(channel: ForumChannel): string {
    const name = channel.name.toLowerCase();
    // Extract the board type from channel name (e.g., "💬│job-board" -> "job-board")
    const match = name.match(/[^a-z0-9]*([a-z0-9-]+)$/i);
    return match?.[1] || name;
  }
}
