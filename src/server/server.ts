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
    discriminator: memberGuild.member.discriminator,
    nickname: memberGuild.nickname,
    displayName: memberGuild.displayName,

    // User Type
    bot: memberGuild.member.bot,
    system: memberGuild.member.system,

    // Appearance
    displayAvatarURL:
      memberGuild.avatarUrl ||
      memberGuild.member.avatarUrl ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(memberGuild.memberId) % 5}.png`,
    avatarUrl: memberGuild.member.avatarUrl || null,
    guildAvatarUrl: memberGuild.avatarUrl || null,
    bannerUrl: memberGuild.bannerUrl || memberGuild.member.bannerUrl || null,
    accentColor: memberGuild.member.accentColor,
    hexAccentColor: memberGuild.member.hexAccentColor || null,
    avatarDecorationUrl:
      memberGuild.avatarDecorationUrl ||
      memberGuild.member.avatarDecorationUrl ||
      null,
    avatarDecorationData:
      memberGuild.avatarDecorationData || memberGuild.member.avatarDecorationData || null,
    displayHexColor: memberGuild.displayHexColor || "#000000",
    displayColor: memberGuild.displayColor || null,
    flags: memberGuild.member.flags?.toString() || null,
    collectibles: memberGuild.member.collectibles || null,
    primaryGuild: memberGuild.member.primaryGuild || null,

    // Roles
    roles,
    highestRolePosition: memberGuild.highestRolePosition || 0,

    // Presence
    status: memberGuild.presenceStatus || "offline",
    activity: memberGuild.presenceActivity || null,
    presenceUpdatedAt: memberGuild.presenceUpdatedAt?.toISOString() || null,

    // Guild Member Status
    pending: memberGuild.pending,
    premiumSince: memberGuild.premiumSince?.toISOString() || null,
    communicationDisabledUntil:
      memberGuild.communicationDisabledUntil?.toISOString() || null,
    guildFlags: memberGuild.flags?.toString() || null,
    bannable: memberGuild.bannable,
    kickable: memberGuild.kickable,
    manageable: memberGuild.manageable,
    moderatable: memberGuild.moderatable,

    // Timestamps
    joinedAt: memberGuild.joinedAt?.toISOString() || null,
    createdAt:
      memberGuild.member.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: memberGuild.member.updatedAt?.toISOString() || null,
    guildUpdatedAt: memberGuild.updatedAt?.toISOString() || null,
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
