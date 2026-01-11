import { parseMultipleUsersWithRoles } from "@/api/mappers/member.mapper";
import { prisma } from "@/prisma";
import { STAFF_ROLES } from "@/shared/config/roles";
import { Elysia, t } from "elysia";

export const staffRoutes = new Elysia().get(
  "/api/:guildId/staff",
  async ({ params }) => {
    const roles = [...STAFF_ROLES, "Booster"];
    
    const staffMemberIds = await prisma.memberRole.findMany({
      where: {
        guildId: params.guildId,
        name: { in: roles },
      },
      select: { memberId: true },
      distinct: ["memberId"],
    });

    return parseMultipleUsersWithRoles(
      staffMemberIds.map((m) => m.memberId),
      params.guildId,
    );
  },
  { params: t.Object({ guildId: t.String() }) },
);
