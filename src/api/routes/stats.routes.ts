import { getTopStatsWithUsers } from "@/api/mappers/stats.mapper";
import { MembersService } from "@/core/services/members/members.service";
import type { Guild } from "discord.js";
import { Elysia, t } from "elysia";

export const statsRoutes = new Elysia()
  .get(
    "/api/:guildId/top",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (ctx: any) => {
      const params = ctx.params as { guildId: string };
      const query = ctx.query as { days?: number; limit?: number };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (ctx: any) => {
      const guild = ctx.guild as Guild;
      return MembersService.getMembersStatsForApi(guild);
    },
    { params: t.Object({ guildId: t.String() }) },
  );
