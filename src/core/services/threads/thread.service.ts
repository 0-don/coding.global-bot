import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/prisma";
import {
  mapAttachment,
  mapEmbed,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";
import {
  ChannelType,
  ForumChannel,
  GuildForumTag,
  Message,
  ThreadChannel,
} from "discord.js";

export class ThreadService {
  static async upsertThread(
    thread: ThreadChannel,
    threadType: string,
  ): Promise<void> {
    const guildId = thread.guildId;
    const authorId = thread.ownerId;
    if (!guildId || !authorId) return;

    let content: string | null = null;
    let imageUrl: string | null = null;

    try {
      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage) {
        content = starterMessage.content || null;
        const imageAttachment = starterMessage.attachments.find((a) =>
          a.contentType?.startsWith("image/"),
        );
        imageUrl = imageAttachment?.url || null;
      }
    } catch (_) {}

    const data: Prisma.ThreadUpsertArgs["create"] = {
      id: thread.id,
      guildId,
      parentId: thread.parentId,
      authorId,
      name: thread.name,
      boardType: threadType,
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
        create: data,
        update: {
          name: data.name,
          content: data.content,
          imageUrl: data.imageUrl,
          messageCount: data.messageCount,
          memberCount: data.memberCount,
          locked: data.locked,
          archived: data.archived,
          archivedAt: data.archivedAt,
          autoArchiveDuration: data.autoArchiveDuration,
          invitable: data.invitable,
          rateLimitPerUser: data.rateLimitPerUser,
          flags: data.flags,
        },
      });

      if (thread.parent?.type === ChannelType.GuildForum) {
        await this.syncThreadTags(thread.id, thread.appliedTags);
      }
    } catch (_) {}
  }

  static async deleteThread(threadId: string): Promise<void> {
    await prisma.thread.delete({ where: { id: threadId } }).catch(() => {});
  }

  static async getThread(threadId: string) {
    return prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        author: { include: { guilds: true, roles: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  static async getThreadsByType(guildId: string, threadType: string) {
    return prisma.thread.findMany({
      where: { guildId, boardType: threadType },
      include: {
        author: {
          include: {
            guilds: { where: { guildId } },
            roles: { where: { guildId } },
          },
        },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async upsertReply(message: Message): Promise<void> {
    const channel = message.channel;
    if (!channel.isThread()) return;

    const threadId = channel.id;
    const guildId = message.guildId;
    const authorId = message.author.id;
    if (!guildId || !authorId) return;

    const thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) return;

    const data = this.parseReplyToDb(message, threadId, guildId);

    try {
      await prisma.threadReply.upsert({
        where: { id: message.id },
        create: data,
        update: {
          content: data.content,
          editedAt: data.editedAt,
          pinned: data.pinned,
          attachments: data.attachments,
          embeds: data.embeds,
          mentions: data.mentions,
          reactions: data.reactions,
          reference: data.reference,
        },
      });
    } catch (_) {}
  }

  static async deleteReply(messageId: string): Promise<void> {
    await prisma.threadReply
      .delete({ where: { id: messageId } })
      .catch(() => {});
  }

  static async getReplies(
    threadId: string,
    options: { after?: string; limit?: number } = {},
  ) {
    const limit = options.limit || 50;

    const replies = await prisma.threadReply.findMany({
      where: {
        threadId,
        ...(options.after && { id: { gt: options.after } }),
      },
      include: { author: { include: { guilds: true, roles: true } } },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
    });

    const hasMore = replies.length > limit;
    const messages = hasMore ? replies.slice(0, limit) : replies;

    return {
      messages,
      hasMore,
      nextCursor: messages[messages.length - 1]?.id ?? null,
    };
  }

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
      await prisma.threadTag.deleteMany({ where: { threadId } });
      if (tagIds.length > 0) {
        await prisma.threadTag.createMany({
          data: tagIds.map((tagId) => ({ threadId, tagId })),
          skipDuplicates: true,
        });
      }
    } catch (_) {}
  }

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

  static getThreadTypeFromChannel(channel: ForumChannel): string {
    const name = channel.name.toLowerCase();
    const match = name.match(/[^a-z0-9]*([a-z0-9-]+)$/i);
    return match?.[1] || name;
  }
}
