import { ThreadService } from "@/core/services/threads/thread.service";
import {
  mapEmbedsFromDb,
  mapMember,
  mapMentionsFromDb,
  mapReactionsFromDb,
  mapReferenceFromDb,
} from "@/shared/mappers/discord.mapper";

type DbThread = Awaited<ReturnType<typeof ThreadService.getThread>>;
type DbThreadList = Awaited<ReturnType<typeof ThreadService.getThreadsByType>>;
type DbReplies = Awaited<ReturnType<typeof ThreadService.getThreadMessages>>;

export function formatThreadFromDb(
  dbThread: NonNullable<DbThread>,
  guildId: string,
) {
  const author = mapMember(dbThread.author, guildId);
  const firstMessage = dbThread.messages[0];
  const attachments = firstMessage?.attachments ?? [];
  const imageAttachment = attachments.find((a) =>
    a.contentType?.startsWith("image/"),
  );
  return {
    id: dbThread.id,
    name: dbThread.name,
    parentId: dbThread.parentId,
    boardType: dbThread.boardType,
    author,
    createdAt: dbThread.createdAt?.toISOString() || null,
    updatedAt: dbThread.updatedAt.toISOString(),
    tags: dbThread.tags.map((tt) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      emoji: {
        id: tt.tag.emojiId || null,
        name: tt.tag.emojiName || null,
      },
    })),
    content: firstMessage?.content || null,
    imageUrl: imageAttachment?.url || null,
    messageCount: dbThread.messageCount,
    totalMessageSent: dbThread.messageCount,
    memberCount: dbThread.memberCount,
    locked: dbThread.locked,
    archived: dbThread.archived,
    archivedAt: dbThread.archivedAt?.toISOString() || null,
    autoArchiveDuration: dbThread.autoArchiveDuration?.toString() || null,
    invitable: dbThread.invitable,
    rateLimitPerUser: dbThread.rateLimitPerUser,
    flags: dbThread.flags?.toString() ?? null,
    firstMessage: firstMessage
      ? formatReplyFromDb(firstMessage, guildId)
      : null,
  };
}

export function formatThreadsFromDb(threads: DbThreadList, guildId: string) {
  return threads.map((thread) => formatThreadFromDb(thread, guildId));
}

export function formatReplyFromDb(
  reply: DbReplies["messages"][number],
  guildId: string,
) {
  return {
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    editedAt: reply.editedAt?.toISOString() || null,
    pinned: reply.pinned,
    tts: reply.tts,
    type: reply.type,
    attachments: reply.attachments,
    embeds: mapEmbedsFromDb(reply.embeds),
    mentions: mapMentionsFromDb(reply.mentions),
    reactions: mapReactionsFromDb(reply.reactions),
    reference: mapReferenceFromDb(reply.reference),
    author: mapMember(reply.author, guildId),
  };
}

export function formatRepliesFromDb(
  replies: DbReplies["messages"],
  guildId: string,
) {
  return replies.map((reply) => formatReplyFromDb(reply, guildId));
}
