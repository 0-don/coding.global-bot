import { ThreadService } from "@/core/services/threads/thread.service";
import {
  DbEmbed,
  extractUserIdsFromContent,
  mapEmbedsFromDb,
  mapMember,
  mapMentionsFromDb,
  mapReactionsFromDb,
  mapReferenceFromDb,
} from "@/shared/mappers/discord.mapper";
import { getMembers } from "./member.mapper";

type DbThread = Awaited<ReturnType<typeof ThreadService.getThread>>;
type DbThreadList = Awaited<ReturnType<typeof ThreadService.getThreadsByType>>;
type DbReplies = Awaited<ReturnType<typeof ThreadService.getThreadMessages>>;

type FormattedMessage = {
  content: string;
  embeds: DbEmbed[];
  mentions: { users: { id: string }[]; roles: { id: string; name: string }[]; everyone: boolean };
};

export async function resolveAndEnrichMentions<T extends FormattedMessage>(
  messages: T[],
  guildId: string,
): Promise<T[]> {
  const userIds = new Set<string>();
  for (const msg of messages) {
    msg.mentions.users.forEach((u) => userIds.add(u.id));
    extractUserIdsFromContent(msg.content, msg.embeds).forEach((id) => userIds.add(id));
  }

  if (userIds.size === 0) return messages;

  const resolved = await getMembers([...userIds], guildId);
  const userMap = new Map(resolved.map((u) => [u.id, u]));

  return messages.map((msg) => ({
    ...msg,
    mentions: {
      ...msg.mentions,
      users: [...new Set([
        ...msg.mentions.users.map((u) => u.id),
        ...extractUserIdsFromContent(msg.content, msg.embeds),
      ])].map((id) => userMap.get(id)).filter(Boolean),
    },
  }));
}

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
    updatedAt: dbThread.updatedAt?.toISOString() || null,
    lastActivityAt: dbThread.lastActivityAt?.toISOString() || dbThread.createdAt?.toISOString() || null,
    tags: dbThread.tags.map((tt) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      emoji: {
        id: tt.tag.emojiId || null,
        name: tt.tag.emojiName || null,
      },
    })),
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

