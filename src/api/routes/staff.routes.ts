import { getMembers } from "@/api/mappers/member.mapper";
import { db } from "@/lib/db";
import { memberRole } from "@/lib/db-schema";
import { and, eq, inArray } from "drizzle-orm";
import { STAFF_ROLES } from "@/shared/config/roles";
import { Elysia, t } from "elysia";

export const staffRoutes = new Elysia().get(
  "/api/:guildId/staff",
  async ({ params }) => {
    const roles = [...STAFF_ROLES, "Booster"];

    const staffMemberIds = await db.query.memberRole.findMany({
      where: and(
        eq(memberRole.guildId, params.guildId),
        inArray(memberRole.name, roles),
      ),
      columns: { memberId: true },
    });

    // Get distinct member IDs
    const uniqueMemberIds = [...new Set(staffMemberIds.map((m) => m.memberId))];

    return getMembers(
      uniqueMemberIds,
      params.guildId,
      { activeOnly: true },
    );
  },
  { params: t.Object({ guildId: t.String() }) },
);
