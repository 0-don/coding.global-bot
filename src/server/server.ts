import { Guild } from "discord.js";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../prisma";

type MemberGuildWithRelations = Prisma.MemberGuildGetPayload<{
  include: {
    member: {
      include: {
        roles: true;
      };
    };
  };
}>;

function formatMemberGuild(
  memberGuild: MemberGuildWithRelations,
  resolvedGuildId: string,
) {
  const roles = memberGuild.member.roles
    .filter((role) => role.roleId !== resolvedGuildId)
    .map((role) => ({
      name: role.name || "",
      position: role.position || 0,
    }));

  return {
    // Identity
    id: memberGuild.memberId,
    username: memberGuild.member.username,
    globalName: memberGuild.member.globalName,
    nickname: memberGuild.nickname,
    displayName: memberGuild.displayName,

    // Appearance
    displayAvatarURL:
      memberGuild.avatarUrl ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(memberGuild.memberId) % 5}.png`,
    bannerUrl: memberGuild.member.bannerUrl || null,
    accentColor: memberGuild.member.accentColor,
    displayHexColor: memberGuild.displayHexColor || "#000000",

    // Roles
    roles,
    highestRolePosition: memberGuild.highestRolePosition || 0,

    // Presence
    status: memberGuild.presenceStatus || "offline",
    activity: memberGuild.presenceActivity || null,
    presenceUpdatedAt: memberGuild.presenceUpdatedAt?.toISOString() || null,

    // Timestamps
    joinedAt: memberGuild.joinedAt?.toISOString() || null,
    createdAt:
      memberGuild.member.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: memberGuild.member.updatedAt?.toISOString() || null,
  };
}

export async function parseUserWithRoles(
  userId: string,
  guildId: string | Guild,
) {
  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const memberGuild = await prisma.memberGuild.findUnique({
    where: {
      member_guild: {
        memberId: userId,
        guildId: resolvedGuildId,
      },
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId: resolvedGuildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
  });

  if (!memberGuild || !memberGuild.status) return null;

  return formatMemberGuild(memberGuild, resolvedGuildId);
}

export async function parseMultipleUsersWithRoles(
  userIds: string[],
  guildId: string | Guild,
) {
  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const members = await prisma.memberGuild.findMany({
    where: {
      memberId: { in: userIds },
      guildId: resolvedGuildId,
      status: true,
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId: resolvedGuildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
  });

  const formattedMembers = members.map((memberGuild) =>
    formatMemberGuild(memberGuild, resolvedGuildId),
  );

  return formattedMembers.sort(
    (a, b) => b.highestRolePosition - a.highestRolePosition,
  );
}
