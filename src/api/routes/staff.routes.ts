import { parseMultipleUsersWithRoles } from "@/api/mappers/member.mapper";
import { prisma } from "@/prisma";
import { PermissionsBitField, type Guild } from "discord.js";
import { Elysia, t } from "elysia";

export const staffRoutes = new Elysia().get(
  "/api/:guildId/staff",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (ctx: any) => {
    const guild = ctx.guild as Guild;
    const params = ctx.params as { guildId: string };

    const memberGuids = await prisma.memberGuild.findMany({
      where: { guildId: params.guildId, status: true },
      include: {
        member: {
          include: { roles: { where: { guildId: params.guildId } } },
        },
      },
    });

    const staffUserIds = memberGuids
      .filter((mg) =>
        mg.member.roles.some((role) => {
          const discordRole = guild.roles.cache.get(role.roleId);
          return (
            discordRole?.permissions.has(
              PermissionsBitField.Flags.MuteMembers,
            ) ||
            discordRole?.permissions.has(
              PermissionsBitField.Flags.ChangeNickname,
            )
          );
        }),
      )
      .map((mg) => mg.memberId);

    const users = await parseMultipleUsersWithRoles(staffUserIds, guild);
    return users.sort(
      (a, b) => b.highestRolePosition - a.highestRolePosition,
    );
  },
  { params: t.Object({ guildId: t.String() }) },
);
