import { guildDerive } from "@/api/middleware/guild.derive";
import { getMembers } from "@/api/mappers/member.mapper";
import { db } from "@/lib/db";
import { memberGuild } from "@/lib/db-schema";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

export const widgetRoutes = new Elysia().use(guildDerive).get(
  "/api/:guildId/widget",
  async ({ guild, params }) => {
    const onlineMembers = await db.query.memberGuild.findMany({
      where: and(
        eq(memberGuild.guildId, params.guildId),
        eq(memberGuild.status, true),
        inArray(memberGuild.presenceStatus, ["online", "idle", "dnd"]),
      ),
      orderBy: desc(memberGuild.highestRolePosition),
      limit: 100,
    });

    const users = await getMembers(
      onlineMembers.map((m) => m.memberId),
      guild,
      { activeOnly: true },
    );

    const [presenceResult] = await db
      .select({ count: count() })
      .from(memberGuild)
      .where(
        and(
          eq(memberGuild.guildId, params.guildId),
          eq(memberGuild.status, true),
          inArray(memberGuild.presenceStatus, ["online", "idle", "dnd"]),
        )
      );
    const presenceCount = presenceResult?.count ?? 0;

    return {
      id: guild.id,
      name: guild.name,
      presenceCount,
      memberCount: guild.memberCount,
      iconURL: guild.iconURL({ extension: "webp", size: 256 }),
      bannerURL: guild.bannerURL({ extension: "webp", size: 1024 }),
      members: users,
    };
  },
  { params: t.Object({ guildId: t.String() }) },
);
