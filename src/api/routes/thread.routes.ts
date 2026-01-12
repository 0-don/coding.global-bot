import {
  formatRepliesFromDb,
  formatThreadFromDb,
  formatThreadsFromDb,
} from "@/api/mappers/thread.mapper";
import { PAGE_LIMIT } from "@/api/middleware/cache";
import { ThreadType, ThreadParams } from "@/api/middleware/validators";
import { SyncAllThreadsService } from "@/core/services/threads/sync-all-threads.service";
import { ThreadService } from "@/core/services/threads/thread.service";
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
        const channel = await guild.channels.fetch(params.threadId).catch(() => null);

        if (channel?.isThread()) {
          await ThreadService.upsertThread(channel, params.threadType);
          await SyncAllThreadsService.syncThreadMessages(channel, params.guildId);
          thread = await ThreadService.getThread(params.threadId);
        }

        if (!thread) {
          throw status("Not Found", "Thread not found");
        }
      }

      return formatThreadFromDb(thread, params.guildId);
    },
    {
      params: ThreadParams,
      query: t.Object({ threadType: t.Optional(ThreadType) }),
    },
  )
  .get(
    "/api/:guildId/thread/:threadType/:threadId/messages",
    async ({ params, query }) => {
      const { messages, hasMore, nextCursor } = await ThreadService.getReplies(
        params.threadId,
        { after: query.after, limit: PAGE_LIMIT },
      );
      return {
        messages: formatRepliesFromDb(messages, params.guildId),
        hasMore,
        nextCursor,
      };
    },
    {
      params: ThreadParams,
      query: t.Object({ after: t.Optional(t.String()) }),
    },
  );
