import { ThreadType } from "@/api/middleware/validators";
import { db } from "@/lib/db";
import { thread, threadMessage, threadTag, tag, attachment } from "@/lib/db-schema";
import { and, eq, gt, ne, asc, desc } from "drizzle-orm";
import {
  mapAttachmentToDb,
  mapEmbed,
  mapMentions,
  mapReactions,
  mapReference,
} from "@/shared/mappers/discord.mapper";
import { log } from "console";
import type { Attachment } from "discord.js";
import {
  ChannelType,
  ForumChannel,
  GuildForumTag,
  Message,
  ThreadChannel,
} from "discord.js";
import { Static } from "elysia";

export class ThreadService {
  static async upsertThread(
    discordThread: ThreadChannel,
    threadType: string,
    options: { syncMessages?: boolean } = {},
  ): Promise<void> {
    const guildId = discordThread.guildId;
    const authorId = discordThread.ownerId;
    if (!guildId || !authorId) return;

    const data = {
      id: discordThread.id,
      guildId,
      parentId: discordThread.parentId,
      authorId,
      name: discordThread.name,
      boardType: threadType,
      messageCount: discordThread.messageCount || 0,
      memberCount: discordThread.memberCount || 0,
      locked: !!discordThread.locked,
      archived: !!discordThread.archived,
      archivedAt: discordThread.archiveTimestamp
        ? new Date(discordThread.archiveTimestamp).toISOString()
        : null,
      autoArchiveDuration: discordThread.autoArchiveDuration || null,
      invitable: discordThread.invitable,
      rateLimitPerUser: discordThread.rateLimitPerUser,
      flags: discordThread.flags.bitfield,
      createdAt: discordThread.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    try {
      const existing = await db.query.thread.findFirst({
        where: eq(thread.id, discordThread.id),
        columns: { name: true, messageCount: true, memberCount: true },
      });

      const hasActivity =
        !existing ||
        existing.name !== data.name ||
        existing.messageCount !== data.messageCount ||
        existing.memberCount !== data.memberCount;

      await db.insert(thread)
        .values(data)
        .onConflictDoUpdate({
          target: thread.id,
          set: {
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
            ...(hasActivity && { lastActivityAt: new Date().toISOString() }),
          },
        });

      if (discordThread.parent?.type === ChannelType.GuildForum) {
        await this.syncThreadTags(discordThread.id, discordThread.appliedTags);
      }

      if (options.syncMessages) {
        await this.syncThreadMessages(discordThread);
      }
    } catch (error) {
      log(
        `[ThreadService] upsertThread failed for thread ${discordThread.id}:`,
        error,
      );
    }
  }

  static async syncThreadMessages(thread: ThreadChannel): Promise<void> {
    try {
      const messages = await thread.messages.fetch();
      for (const message of messages.values()) {
        await this.upsertThreadMessage(message);
      }
    } catch (error) {
      log(
        `[ThreadService] syncThreadMessages failed for thread ${thread.id}:`,
        error,
      );
    }
  }

  static async deleteThread(threadId: string): Promise<void> {
    await db.delete(thread).where(eq(thread.id, threadId)).catch(() => {});
  }

  static async getThreadLookup(threadId: string) {
    return db.query.thread.findFirst({
      where: eq(thread.id, threadId),
      columns: { id: true, boardType: true },
    });
  }

  static async getThread(threadId: string) {
    return db.query.thread.findFirst({
      where: eq(thread.id, threadId),
      with: {
        member: { with: { memberGuilds: true, memberRoles: true } },
        threadTags: { with: { tag: true } },
        threadMessages: {
          where: eq(threadMessage.id, threadId),
          with: {
            member: { with: { memberGuilds: true, memberRoles: true } },
            attachments: true,
          },
          limit: 1,
        },
      },
    });
  }

  static async getThreadsByType(guildId: string, threadType: string) {
    const threads = await db.query.thread.findMany({
      where: and(eq(thread.guildId, guildId), eq(thread.boardType, threadType)),
      with: {
        member: {
          with: {
            memberGuilds: true,
            memberRoles: true,
          },
        },
        threadTags: { with: { tag: true } },
        threadMessages: {
          with: {
            member: { with: { memberGuilds: true, memberRoles: true } },
            attachments: true,
          },
          limit: 1,
          orderBy: asc(threadMessage.createdAt),
        },
      },
      orderBy: desc(thread.createdAt),
    });

    return threads.map((t) => ({
      ...t,
      threadMessages: t.threadMessages.filter((m) => m.id === t.id),
    }));
  }

  static async upsertThreadMessage(message: Message): Promise<void> {
    const channel = message.channel;
    if (!channel.isThread()) return;

    const threadId = channel.id;
    const guildId = message.guildId;
    const authorId = message.author.id;
    if (!guildId || !authorId) return;

    const existingThread = await db.query.thread.findFirst({ where: eq(thread.id, threadId) });
    if (!existingThread) {
      const parentChannel = channel.parent;
      if (parentChannel?.type === ChannelType.GuildForum) {
        const threadType = this.getThreadTypeFromChannel(parentChannel);
        await this.upsertThread(channel, threadType);
      } else {
        log(
          `[ThreadService] skipping upsertThreadMessage - thread ${threadId} not in DB and parent is not a forum (parent: ${parentChannel?.type ?? "null"})`,
        );
        return;
      }
    }

    const data = this.parseThreadMessageToDb(message, threadId, guildId);
    const attachments = Array.from(message.attachments.values());

    try {
      await db.insert(threadMessage)
        .values(data)
        .onConflictDoUpdate({
          target: threadMessage.id,
          set: {
            content: data.content,
            editedAt: data.editedAt,
            pinned: data.pinned,
            embeds: data.embeds,
            mentions: data.mentions,
            reactions: data.reactions,
            reference: data.reference,
          },
        });
      await this.upsertAttachments(message.id, attachments);
    } catch (error) {
      log(
        `[ThreadService] upsertThreadMessage failed for message ${message.id} in thread ${threadId}:`,
        error,
      );
    }

    try {
      await db.update(thread)
        .set({ lastActivityAt: new Date().toISOString() })
        .where(eq(thread.id, threadId));
    } catch (error) {
      log(
        `[ThreadService] lastActivityAt update failed for thread ${threadId}, retrying:`,
        error,
      );
      try {
        await db.update(thread)
          .set({ lastActivityAt: new Date().toISOString() })
          .where(eq(thread.id, threadId));
      } catch (retryError) {
        log(
          `[ThreadService] lastActivityAt retry also failed for thread ${threadId}:`,
          retryError,
        );
      }
    }
  }

  static async upsertAttachments(
    messageId: string,
    attachments: Attachment[],
  ): Promise<void> {
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
  }

  static async deleteThreadMessage(messageId: string): Promise<void> {
    await db.delete(threadMessage)
      .where(eq(threadMessage.id, messageId))
      .catch(() => {});
  }

  static async getThreadMessages(
    threadId: string,
    options: { after?: string; limit?: number } = {},
  ) {
    const limit = options.limit || 50;

    const conditions = [
      eq(threadMessage.threadId, threadId),
      ne(threadMessage.id, threadId),
    ];
    if (options.after) {
      conditions.push(gt(threadMessage.id, options.after));
    }

    const replies = await db.query.threadMessage.findMany({
      where: and(...conditions),
      with: {
        member: { with: { memberGuilds: true, memberRoles: true } },
        attachments: true,
      },
      orderBy: asc(threadMessage.createdAt),
      limit: limit + 1,
    });

    // Filter out bot authors (post-query since we can't join filter easily)
    const filteredReplies = replies.filter((r) => !r.member?.bot);

    const hasMore = filteredReplies.length > limit;
    const messages = hasMore ? filteredReplies.slice(0, limit) : filteredReplies;

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
    for (const forumTag of tags) {
      try {
        await db.insert(tag)
          .values({
            id: forumTag.id,
            guildId,
            name: forumTag.name,
            emojiId: forumTag.emoji?.id || null,
            emojiName: forumTag.emoji?.name || null,
          })
          .onConflictDoUpdate({
            target: tag.id,
            set: {
              name: forumTag.name,
              emojiId: forumTag.emoji?.id || null,
              emojiName: forumTag.emoji?.name || null,
            },
          });
      } catch (error) {
        log(`[ThreadService] upsertTags failed for tag ${forumTag.id}:`, error);
      }
    }
  }

  static async syncThreadTags(
    threadId: string,
    tagIds: string[],
  ): Promise<void> {
    try {
      const existingTags = await db.query.threadTag.findMany({
        where: eq(threadTag.threadId, threadId),
        columns: { tagId: true },
      });
      const existingTagIds = existingTags.map((t) => t.tagId).sort();
      const newTagIds = [...tagIds].sort();
      const tagsChanged =
        existingTagIds.length !== newTagIds.length ||
        existingTagIds.some((id, i) => id !== newTagIds[i]);

      await db.delete(threadTag).where(eq(threadTag.threadId, threadId));
      if (tagIds.length > 0) {
        await db.insert(threadTag)
          .values(tagIds.map((tagId) => ({ threadId, tagId })))
          .onConflictDoNothing();
      }

      if (tagsChanged) {
        await db.update(thread)
          .set({ lastActivityAt: new Date().toISOString() })
          .where(eq(thread.id, threadId));
      }
    } catch (error) {
      log(
        `[ThreadService] syncThreadTags failed for thread ${threadId}:`,
        error,
      );
    }
  }

  static parseThreadMessageToDb(
    message: Message,
    threadId: string,
    guildId: string,
  ) {
    return {
      id: message.id,
      threadId,
      authorId: message.author.id,
      guildId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      pinned: message.pinned,
      tts: message.tts,
      type: message.type.toString(),
      embeds: message.embeds.map(mapEmbed),
      mentions: mapMentions(message.mentions),
      reactions: mapReactions(message.reactions.cache.values()),
      reference: mapReference(message.reference) ?? null,
    };
  }

  static getThreadTypeFromChannel(channel: ForumChannel) {
    const name = channel.name.toLowerCase();
    const match = name.match(/[^a-z0-9]*([a-z0-9-]+)$/i);
    return (match?.[1] || name) as Static<typeof ThreadType>;
  }
}
