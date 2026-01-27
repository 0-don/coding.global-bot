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
import { Elysia, status, t } from "elysia";
import { guildDerive } from "../middleware/guild.derive";

export const threadRoutes = new Elysia()
  .use(guildDerive)
  .get(
    "/api/:guildId/thread/:threadType",
    async ({ params }) => {
      const threadType = params.threadType.toLowerCase();
      const threads = await ThreadService.getThreadsByType(
        params.guildId,
        threadType,
      );
      return formatThreadsFromDb(threads, params.guildId);
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
      if (!formatted.firstMessage) return { ...formatted, firstMessage: null };

      const [enriched] = await resolveAndEnrichMentions([formatted.firstMessage], params.guildId);
      return { ...formatted, firstMessage: enriched };
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

      const formatted = messages.map((m) => formatReplyFromDb(m, params.guildId));
      const enriched = await resolveAndEnrichMentions(formatted, params.guildId);
      return { messages: enriched, hasMore, nextCursor };
    },
    {
      params: ThreadParams,
      query: t.Object({ after: t.Optional(t.String()) }),
    },
  );
