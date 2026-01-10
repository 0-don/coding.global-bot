import {
  ChannelType,
  ForumChannel,
  GuildForumTag,
  Message,
  ThreadChannel,
} from "discord.js";
import { prisma } from "../../prisma";
import type { Prisma } from "../../generated/prisma/client";

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
      nextCursor: messages.at(-1)?.id ?? null,
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
      editedAt: message.editedAt || null,
      pinned: message.pinned,
      tts: message.tts,
      type: message.type.toString(),
      attachments: Array.from(message.attachments.values()).map(
        (attachment) => ({
          id: attachment.id,
          url: attachment.url,
          proxyURL: attachment.proxyURL,
          name: attachment.name,
          description: attachment.description || null,
          contentType: attachment.contentType || null,
          size: attachment.size,
          width: attachment.width || null,
          height: attachment.height || null,
          ephemeral: attachment.ephemeral,
          duration: attachment.duration || null,
          waveform: attachment.waveform || null,
          flags: attachment.flags?.bitfield.toString() || null,
        }),
      ),
      embeds: message.embeds.map((embed) => ({
        title: embed.title || null,
        description: embed.description || null,
        url: embed.url || null,
        color: embed.color || null,
        timestamp: embed.timestamp || null,
        fields: embed.fields.map((field) => ({
          name: field.name,
          value: field.value,
          inline: field.inline,
        })),
        author: embed.author
          ? {
              name: embed.author.name,
              url: embed.author.url || null,
              iconURL: embed.author.iconURL || null,
              proxyIconURL: embed.author.proxyIconURL || null,
            }
          : null,
        thumbnail: embed.thumbnail
          ? {
              url: embed.thumbnail.url,
              proxyURL: embed.thumbnail.proxyURL || null,
              width: embed.thumbnail.width || null,
              height: embed.thumbnail.height || null,
            }
          : null,
        image: embed.image
          ? {
              url: embed.image.url,
              proxyURL: embed.image.proxyURL || null,
              width: embed.image.width || null,
              height: embed.image.height || null,
            }
          : null,
        video: embed.video
          ? {
              url: embed.video.url || null,
              proxyURL: embed.video.proxyURL || null,
              width: embed.video.width || null,
              height: embed.video.height || null,
            }
          : null,
        footer: embed.footer
          ? {
              text: embed.footer.text,
              iconURL: embed.footer.iconURL || null,
              proxyIconURL: embed.footer.proxyIconURL || null,
            }
          : null,
        provider: embed.provider
          ? {
              name: embed.provider.name || null,
              url: embed.provider.url || null,
            }
          : null,
      })),
      mentions: {
        users: message.mentions.users.map((user) => ({
          id: user.id,
          username: user.username,
          globalName: user.globalName,
        })),
        roles: message.mentions.roles.map((role) => ({
          id: role.id,
          name: role.name,
        })),
        everyone: message.mentions.everyone,
      },
      reactions: message.reactions.cache.map((reaction) => ({
        emoji: {
          id: reaction.emoji.id,
          name: reaction.emoji.name,
        },
        count: reaction.count,
      })),
      reference: message.reference
        ? {
            messageId: message.reference.messageId || null,
            channelId: message.reference.channelId,
            guildId: message.reference.guildId || null,
          }
        : undefined,
    };
  }

  static getBoardTypeFromChannel(channel: ForumChannel): string {
    const name = channel.name.toLowerCase();
    // Extract the board type from channel name (e.g., "💬│job-board" -> "job-board")
    const match = name.match(/[^a-z0-9]*([a-z0-9-]+)$/i);
    return match?.[1] || name;
  }
}
