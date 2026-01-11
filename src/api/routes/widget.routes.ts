import { parseMultipleUsersWithRoles } from "@/api/mappers/member.mapper";
import { prisma } from "@/prisma";
import type { Guild } from "discord.js";
import { Elysia, t } from "elysia";

export const widgetRoutes = new Elysia().get(
  "/api/:guildId/widget",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (ctx: any) => {
    const guild = ctx.guild as Guild;
    const params = ctx.params as { guildId: string };
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
