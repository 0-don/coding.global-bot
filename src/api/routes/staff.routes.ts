import { guildDerive } from "@/api/middleware/guild.derive";
import { parseMultipleUsersWithRoles } from "@/api/mappers/member.mapper";
import { STAFF_ROLES } from "@/shared/config/roles";
import { Elysia, t } from "elysia";

export const staffRoutes = new Elysia().use(guildDerive).get(
  "/api/:guildId/staff",
  async ({ guild }) => {
    const staffMembers = guild.members.cache.filter((m) =>
      m.roles.cache.some((r) => STAFF_ROLES.includes(r.id)),
    );
    return parseMultipleUsersWithRoles(
      staffMembers.map((m) => m.id),
      guild,
    );
  },
  { params: t.Object({ guildId: t.String() }) },
);
