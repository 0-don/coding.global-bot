import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/prisma";
import {
  mapAttachmentToDb,
  mapEmbed,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";
import type { Attachment } from "discord.js";
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
    options: { syncMessages?: boolean } = {},
  ): Promise<void> {
    const guildId = thread.guildId;
    const authorId = thread.ownerId;
    if (!guildId || !authorId) return;

    const data: Prisma.ThreadUpsertArgs["create"] = {
      id: thread.id,
      guildId,
      parentId: thread.parentId,
      authorId,
      name: thread.name,
      boardType: threadType,
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
      lastActivityAt: new Date(),
    };

    try {
      const existing = await prisma.thread.findUnique({
        where: { id: thread.id },
        select: { name: true, messageCount: true, memberCount: true },
      });

      const hasActivity =
        !existing ||
        existing.name !== data.name ||
        existing.messageCount !== data.messageCount ||
        existing.memberCount !== data.memberCount;

      await prisma.thread.upsert({
        where: { id: thread.id },
        create: data,
        update: {
          name: data.name,
          messageCount: data.messageCount,
          memberCount: data.memberCount,
          locked: data.locked,
          archived: data.archived,
          archivedAt: data.archivedAt,
          autoArchiveDuration: data.autoArchiveDuration,
          invitable: data.invitable,
          rateLimitPerUser: data.rateLimitPerUser,
          flags: data.flags,
          ...(hasActivity && { lastActivityAt: new Date() }),
        },
      });

      if (thread.parent?.type === ChannelType.GuildForum) {
        await this.syncThreadTags(thread.id, thread.appliedTags);
      }

      if (options.syncMessages) {
        await this.syncThreadMessages(thread);
      }
    } catch (_) {}
  }

  static async syncThreadMessages(thread: ThreadChannel): Promise<void> {
    try {
      const messages = await thread.messages.fetch();
      for (const message of messages.values()) {
        await this.upsertThreadMessage(message);
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
        messages: {
          where: { id: threadId },
          include: {
            author: { include: { guilds: true, roles: true } },
            attachments: true,
          },
          take: 1,
        },
      },
    });
  }

  static async getThreadsByType(guildId: string, threadType: string) {
    const threads = await prisma.thread.findMany({
      where: { guildId, boardType: threadType },
      include: {
        author: {
          include: {
            guilds: { where: { guildId } },
            roles: { where: { guildId } },
          },
        },
        tags: { include: { tag: true } },
        messages: {
          include: {
            author: { include: { guilds: true, roles: true } },
            attachments: true,
          },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return threads.map((thread) => ({
      ...thread,
      messages: thread.messages.filter((m) => m.id === thread.id),
    }));
  }

  static async upsertThreadMessage(message: Message): Promise<void> {
    const channel = message.channel;
    if (!channel.isThread()) return;

    const threadId = channel.id;
    const guildId = message.guildId;
    const authorId = message.author.id;
    if (!guildId || !authorId) return;

    const thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) {
      const parentChannel = channel.parent;
      if (parentChannel?.type === ChannelType.GuildForum) {
        const threadType = this.getThreadTypeFromChannel(parentChannel);
        await this.upsertThread(channel, threadType);
      } else {
        return;
      }
    }

    const data = this.parseThreadMessageToDb(message, threadId, guildId);
    const attachments = Array.from(message.attachments.values());

    try {
      await prisma.threadMessage.upsert({
        where: { id: message.id },
        create: data,
        update: {
          content: data.content,
          editedAt: data.editedAt,
          pinned: data.pinned,
          embeds: data.embeds,
          mentions: data.mentions,
          reactions: data.reactions,
          reference: data.reference,
        },
      });

      await prisma.thread.update({
        where: { id: threadId },
        data: { lastActivityAt: new Date() },
      });

      await this.upsertAttachments(message.id, attachments);
    } catch (_) {}
  }

  static async upsertAttachments(
    messageId: string,
    attachments: Attachment[],
  ): Promise<void> {
    if (attachments.length === 0) {
      await prisma.attachment.deleteMany({ where: { messageId } });
      return;
    }

    const attachmentData = attachments.map((a) => mapAttachmentToDb(a, messageId));

    await prisma.$transaction([
      prisma.attachment.deleteMany({ where: { messageId } }),
      prisma.attachment.createMany({ data: attachmentData }),
    ]);
  }

  static async deleteThreadMessage(messageId: string): Promise<void> {
    await prisma.threadMessage
      .delete({ where: { id: messageId } })
      .catch(() => {});
  }

  static async getThreadMessages(
    threadId: string,
    options: { after?: string; limit?: number } = {},
  ) {
    const limit = options.limit || 50;

    const replies = await prisma.threadMessage.findMany({
      where: {
        threadId,
        id: { not: threadId, ...(options.after && { gt: options.after }) },
      },
      include: {
        author: { include: { guilds: true, roles: true } },
        attachments: true,
      },
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
      const existingTags = await prisma.threadTag.findMany({
        where: { threadId },
        select: { tagId: true },
      });
      const existingTagIds = existingTags.map((t) => t.tagId).sort();
      const newTagIds = [...tagIds].sort();
      const tagsChanged =
        existingTagIds.length !== newTagIds.length ||
        existingTagIds.some((id, i) => id !== newTagIds[i]);

      await prisma.threadTag.deleteMany({ where: { threadId } });
      if (tagIds.length > 0) {
        await prisma.threadTag.createMany({
          data: tagIds.map((tagId) => ({ threadId, tagId })),
          skipDuplicates: true,
        });
      }

      if (tagsChanged) {
        await prisma.thread.update({
          where: { id: threadId },
          data: { lastActivityAt: new Date() },
        });
      }
    } catch (_) {}
  }

  static parseThreadMessageToDb(
    message: Message,
    threadId: string,
    guildId: string,
  ): Prisma.ThreadMessageCreateInput {
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
