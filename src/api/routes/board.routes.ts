import {
  formatRepliesFromDb,
  formatThreadFromDb,
  formatThreadsFromDb,
} from "@/api/mappers/thread.mapper";
import { PAGE_LIMIT } from "@/api/middleware/cache";
import { BoardType, ThreadParams } from "@/api/middleware/validators";
import { ThreadService } from "@/core/services/threads/thread.service";
import { Elysia, status, t } from "elysia";

export const boardRoutes = new Elysia()
  .get(
    "/api/:guildId/board/:boardType",
    async ({ params }) => {
      const boardType = params.boardType.toLowerCase();
      const threads = await ThreadService.getThreadsByBoard(
        params.guildId,
        boardType,
      );
      return formatThreadsFromDb(threads, params.guildId);
    },
    { params: t.Object({ guildId: t.String(), boardType: BoardType }) },
  )
  .get(
    "/api/:guildId/board/:boardType/:threadId",
    async ({ params }) => {
      const thread = await ThreadService.getThread(params.threadId);
      if (!thread) {
        throw status("Not Found", "Thread not found");
      }
      const formatedThread = formatThreadFromDb(thread, params.guildId);
      return formatedThread;
    },
    {
      params: ThreadParams,
      query: t.Object({ boardType: t.Optional(BoardType) }),
    },
  )
  .get(
    "/api/:guildId/board/:boardType/:threadId/messages",
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
