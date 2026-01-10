import type { Prisma } from "../../generated/prisma/client";

export type MemberGuildWithRelations = Prisma.MemberGuildGetPayload<{
  include: {
    member: {
      include: {
        roles: true;
      };
    };
  };
}>;

export function formatMemberGuild(
  memberGuild: MemberGuildWithRelations,
  guildId: string,
) {
  const roles = memberGuild.member.roles
    .filter((role) => role.roleId !== guildId)
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
    avatarUrl:
      memberGuild.avatarUrl ||
      memberGuild.member.avatarUrl ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(memberGuild.memberId) % 5}.png`,
    bannerUrl: memberGuild.bannerUrl || memberGuild.member.bannerUrl || null,
    accentColor: memberGuild.member.accentColor,
    displayHexColor: memberGuild.displayHexColor || "#000000",
    flags: memberGuild.member.flags?.toString() || null,
    collectibles: JSON.stringify(memberGuild.member.collectibles) || null,
    primaryGuild: JSON.stringify(memberGuild.member.primaryGuild) || null,

    // Roles
    roles,
    highestRolePosition: memberGuild.highestRolePosition || 0,

    // Presence
    status: memberGuild.presenceStatus || "offline",
    activity: memberGuild.presenceActivity || null,
    presenceUpdatedAt: memberGuild.presenceUpdatedAt?.toISOString() || null,

    // Timestamps
    premiumSince: memberGuild.premiumSince?.toISOString() || null,
    communicationDisabledUntil:
      memberGuild.communicationDisabledUntil?.toISOString() || null,
    joinedAt: memberGuild.joinedAt?.toISOString() || null,
    createdAt:
      memberGuild.member.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: memberGuild.member.updatedAt?.toISOString() || null,
  };
}
