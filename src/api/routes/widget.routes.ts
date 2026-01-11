import { guildDerive } from "@/api/middleware/guild.derive";
import { parseMultipleUsersWithRoles } from "@/api/mappers/member.mapper";
import { prisma } from "@/prisma";
import { Elysia, t } from "elysia";

export const widgetRoutes = new Elysia()
  .use(guildDerive)
  .get(
    "/api/:guildId/widget",
    async ({ guild, params }) => {
      const onlineMembers = await prisma.memberGuild.findMany({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: { in: ["online", "idle", "dnd"] },
        },
        orderBy: { highestRolePosition: "desc" },
        take: 100,
      });

      const users = await parseMultipleUsersWithRoles(
        onlineMembers.map((m) => m.memberId),
        guild,
      );
      const presenceCount = await prisma.memberGuild.count({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: { in: ["online", "idle", "dnd"] },
        },
      });

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
