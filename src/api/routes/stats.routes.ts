import { guildDerive } from "@/api/middleware/guild.derive";
import { getTopStatsWithUsers } from "@/api/mappers/stats.mapper";
import { MembersService } from "@/core/services/members/members.service";
import { Elysia, t } from "elysia";

export const statsRoutes = new Elysia()
  .use(guildDerive)
  .get(
    "/api/:guildId/top",
    async ({ params, query }) => {
      return getTopStatsWithUsers(
        params.guildId,
        query.days ?? 9999,
        query.limit ?? 5,
      );
    },
    {
      params: t.Object({ guildId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.Number({ default: 5, minimum: 1, maximum: 10 })),
        days: t.Optional(
          t.Number({ default: 9999, minimum: 1, maximum: 9999 }),
        ),
      }),
    },
  )
  .get(
    "/api/:guildId/members",
    async ({ guild }) => {
      return MembersService.getMembersStatsForApi(guild);
    },
    { params: t.Object({ guildId: t.String() }) },
  );
