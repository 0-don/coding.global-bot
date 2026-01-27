import {
  formatReplyFromDb,
  formatThreadFromDb,
  formatThreadsFromDb,
  resolveAndEnrichMentions,
} from "@/api/mappers/thread.mapper";
import { PAGE_LIMIT } from "@/api/middleware/cache";
import { ThreadParams, ThreadType } from "@/api/middleware/validators";
import { ThreadService } from "@/core/services/threads/thread.service";
import { SyncAllThreadsService } from "@/core/services/threads/verify-threads.service";
import { ForumChannel } from "discord.js";
import { Elysia, status, t } from "elysia";
import { guildDerive } from "../middleware/guild.derive";

export const threadRoutes = new Elysia()
  .use(guildDerive)
  .get(
    "/api/:guildId/thread-lookup/:threadId",
    async ({ params, guild }) => {
      const thread = await ThreadService.getThreadLookup(params.threadId);

      if (thread) {
        return { boardType: thread.boardType, threadId: thread.id };
      }

      const channel = await guild.channels
        .fetch(params.threadId)
        .catch(() => null);

      if (!channel?.isThread() || !channel.parent) {
        throw status("Not Found", "Thread not found");
      }

      const boardType = ThreadService.getThreadTypeFromChannel(
        channel.parent as ForumChannel,
      );

      return { boardType, threadId: params.threadId };
    },
    { params: t.Object({ guildId: t.String(), threadId: t.String() }) },
  )
  .get(
    "/api/:guildId/thread/:threadType",
    async ({ params }) => {
      const threadType = params.threadType.toLowerCase();
      const threads = await ThreadService.getThreadsByType(
        params.guildId,
        threadType,
      );
      const formatted = formatThreadsFromDb(threads, params.guildId);

      const firstMessages = formatted
        .map((t) => t.firstMessage)
        .filter((m): m is NonNullable<typeof m> => m !== null);

      const enriched = await resolveAndEnrichMentions(
        firstMessages,
        params.guildId,
      );
      let i = 0;

      return formatted.map((thread) => ({
        ...thread,
        firstMessage: thread.firstMessage ? enriched[i++] : null,
      }));
    },
    { params: t.Object({ guildId: t.String(), threadType: ThreadType }) },
  )
  .get(
    "/api/:guildId/thread/:threadType/:threadId",
    async ({ params, guild }) => {
      let thread = await ThreadService.getThread(params.threadId);

      if (!thread) {
        const channel = await guild.channels
          .fetch(params.threadId)
          .catch(() => null);

        if (channel?.isThread()) {
          await ThreadService.upsertThread(channel, params.threadType);
          await SyncAllThreadsService.syncThreadMessages(
            channel,
            params.guildId,
          );
          thread = await ThreadService.getThread(params.threadId);
        }

        if (!thread) {
          throw status("Not Found", "Thread not found");
        }
      }

      const formatted = formatThreadFromDb(thread, params.guildId);

      return {
        ...formatted,
        firstMessage: (formatted.firstMessage
          ? (
              await resolveAndEnrichMentions(
                [formatted.firstMessage],
                params.guildId,
              )
            )[0]!
          : null!)!,
      };
    },
    {
      params: ThreadParams,
      query: t.Object({ threadType: t.Optional(ThreadType) }),
    },
  )
  .get(
    "/api/:guildId/thread/:threadType/:threadId/messages",
    async ({ params, query }) => {
      const { messages, hasMore, nextCursor } =
        await ThreadService.getThreadMessages(params.threadId, {
          after: query.after,
          limit: PAGE_LIMIT,
        });

      const formatted = messages.map((m) =>
        formatReplyFromDb(m, params.guildId),
      );
      const enriched = await resolveAndEnrichMentions(
        formatted,
        params.guildId,
      );
      return { messages: enriched, hasMore, nextCursor };
    },
    {
      params: ThreadParams,
      query: t.Object({ after: t.Optional(t.String()) }),
    },
  );
