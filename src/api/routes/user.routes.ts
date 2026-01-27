import { searchUsers } from "@/api/mappers/member.mapper";
import { getUserStatsForApi } from "@/api/mappers/stats.mapper";
import { Elysia, status, t } from "elysia";

export const userRoutes = new Elysia()
  .get(
    "/api/:guildId/user/search",
    async ({ params, query }) => {
      if (!query.q || query.q.trim().length === 0) {
        throw status("Bad Request", "Query parameter 'q' is required");
      }
      return searchUsers(params.guildId, query.q.trim(), query.limit ?? 10);
    },
    {
      params: t.Object({ guildId: t.String() }),
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50 })),
      }),
    },
  )
  .post(
    "/api/:guildId/users",
    async ({ params, body }) => {
      const uniqueUserIds = [...new Set(body.userIds)];
      return getUserStatsForApi(uniqueUserIds, params.guildId);
    },
    {
      params: t.Object({ guildId: t.String() }),
      body: t.Object({ userIds: t.Array(t.String()) }),
    },
  );
