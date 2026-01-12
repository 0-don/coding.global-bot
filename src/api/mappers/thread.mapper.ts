import { ThreadService } from "@/core/services/threads/thread.service";
import {
  mapAttachmentsFromDb,
  mapEmbedsFromDb,
  mapMember,
  mapMentionsFromDb,
  mapReactionsFromDb,
  mapReferenceFromDb,
} from "@/shared/mappers/discord.mapper";

type DbThread = Awaited<ReturnType<typeof ThreadService.getThread>>;
type DbThreadList = Awaited<ReturnType<typeof ThreadService.getThreadsByType>>;
type DbReplies = Awaited<ReturnType<typeof ThreadService.getReplies>>;

export function formatThreadFromDb(
  dbThread: NonNullable<DbThread>,
  guildId: string,
) {
  const author = mapMember(dbThread.author, guildId);
  const firstMessage = dbThread.messages[0];
  const attachments = firstMessage
    ? mapAttachmentsFromDb(firstMessage.attachments)
    : [];
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
      ? {
          id: firstMessage.id,
          content: firstMessage.content,
          createdAt: firstMessage.createdAt.toISOString(),
          editedAt: firstMessage.editedAt?.toISOString() || null,
          pinned: firstMessage.pinned,
          tts: firstMessage.tts,
          type: firstMessage.type,
          attachments,
          embeds: mapEmbedsFromDb(firstMessage.embeds),
          mentions: mapMentionsFromDb(firstMessage.mentions),
          reactions: mapReactionsFromDb(firstMessage.reactions),
          reference: mapReferenceFromDb(firstMessage.reference),
          author: mapMember(firstMessage.author, guildId),
        }
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
    attachments: mapAttachmentsFromDb(reply.attachments),
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
