import type { GuildMember, Presence, User } from "discord.js";
import { prisma } from "../../prisma";
import { EVERYONE } from "../constants";

/**
 * Prepares global user data for database storage
 */
export function prepareMemberData(user: User) {
  return {
    memberId: user.id,
    username: user.username,
    globalName: user.globalName,
    createdAt: user.createdAt,
    bannerUrl: user.bannerURL({ size: 1024 }) || null,
    accentColor: user.accentColor,
  };
}

/**
 * Prepares guild-specific member data for database storage
 */
export function prepareMemberGuildData(member: GuildMember) {
  const sortedRoles = Array.from(member.roles.cache.values())
    .filter((role) => role.name !== EVERYONE)
    .sort((a, b) => b.position - a.position);

  return {
    memberId: member.id,
    guildId: member.guild.id,
    status: true,
    nickname: member.nickname,
    displayName: member.displayName,
    joinedAt: member.joinedAt,
    displayHexColor: member.displayHexColor,
    highestRolePosition: sortedRoles[0]?.position || null,
    avatarUrl: member.avatarURL({ size: 1024 }) || null,
    presenceStatus: member.presence?.status || null,
    presenceActivity: member.presence?.activities[0]?.name || null,
    presenceUpdatedAt: member.presence ? new Date() : null,
  };
}

/**
 * Prepares member roles data for database storage
 */
export function prepareMemberRolesData(member: GuildMember) {
  return member.roles.cache
    .filter((role) => role.name !== EVERYONE)
    .map((role) => ({
      roleId: role.id,
      name: role.name,
      position: role.position,
      color: role.colors?.primaryColor || null,
      hexColor: role.hexColor,
      hoist: role.hoist,
      icon: role.icon,
      unicodeEmoji: role.unicodeEmoji,
      mentionable: role.mentionable,
      managed: role.managed,
      tags: role.tags ? JSON.parse(JSON.stringify(role.tags)) : null,
      memberId: member.id,
      guildId: member.guild.id,
    }));
}

/**
 * Prepares presence data for database storage
 */
export function preparePresenceData(
  presence: GuildMember["presence"] | Presence | null | undefined,
) {
  return {
    presenceStatus: presence?.status || null,
    presenceActivity: presence?.activities[0]?.name || null,
    presenceUpdatedAt: presence ? new Date() : null,
  };
}

/**
 * Updates global user data in database
 * Force fetches user to get complete data including banner and accent color
 */
export async function updateUserData(user: User) {
  // Force fetch to get banner and accent color data
  const fetchedUser = await user.fetch(true).catch(() => user);

  // Prepare member data
  const memberData = prepareMemberData(fetchedUser);

  // Update user data in database
  await prisma.member.upsert({
    where: { memberId: memberData.memberId },
    create: memberData,
    update: {
      username: memberData.username,
      globalName: memberData.globalName,
      createdAt: memberData.createdAt,
      bannerUrl: memberData.bannerUrl,
      accentColor: memberData.accentColor,
    },
  });

  return memberData;
}

/**
 * Updates guild-specific member data in database
 */
export async function updateMemberGuildData(member: GuildMember) {
  // Prepare member guild data
  const memberGuildData = prepareMemberGuildData(member);

  // Update member guild data in database
  await prisma.memberGuild.upsert({
    where: {
      member_guild: {
        memberId: memberGuildData.memberId,
        guildId: memberGuildData.guildId,
      },
    },
    create: memberGuildData,
    update: {
      status: memberGuildData.status,
      nickname: memberGuildData.nickname,
      displayName: memberGuildData.displayName,
      joinedAt: memberGuildData.joinedAt,
      displayHexColor: memberGuildData.displayHexColor,
      highestRolePosition: memberGuildData.highestRolePosition,
      avatarUrl: memberGuildData.avatarUrl,
      presenceStatus: memberGuildData.presenceStatus,
      presenceActivity: memberGuildData.presenceActivity,
      presenceUpdatedAt: memberGuildData.presenceUpdatedAt,
    },
  });

  return memberGuildData;
}

/**
 * Updates member roles data in database
 */
export async function updateMemberRolesData(member: GuildMember) {
  // Prepare member roles data
  const memberRoleCreates = prepareMemberRolesData(member);

  // Delete existing roles and create new ones
  await prisma.$transaction(async (tx) => {
    await tx.memberRole.deleteMany({
      where: { memberId: member.id, guildId: member.guild.id },
    });

    if (memberRoleCreates.length > 0) {
      await tx.memberRole.createMany({
        data: memberRoleCreates,
        skipDuplicates: true,
      });
    }
  });

  return memberRoleCreates;
}

/**
 * Updates presence data in database
 */
export async function updatePresenceData(
  userId: string,
  guildId: string,
  presence: GuildMember["presence"] | Presence | null | undefined,
) {
  // Prepare presence data
  const presenceData = preparePresenceData(presence);

  // Update presence data in MemberGuild
  await prisma.memberGuild.updateMany({
    where: {
      memberId: userId,
      guildId: guildId,
    },
    data: presenceData,
  });

  return presenceData;
}

/**
 * Complete member data update
 * Force fetches user and updates all member data (user, guild, roles)
 * This is the main function used in verify-all and should be used consistently across all events
 */
export async function updateCompleteMemberData(member: GuildMember) {
  // Force fetch user to get banner and accent color data
  const user = await member.user.fetch(true);

  // Prepare all data
  const memberData = prepareMemberData(user);
  const memberGuildData = prepareMemberGuildData(member);
  const memberRoleCreates = prepareMemberRolesData(member);

  // Update database with all fetched data in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing roles to avoid duplicates
    await tx.memberRole.deleteMany({
      where: { memberId: member.id, guildId: member.guild.id },
    });

    // Upsert member (global user data)
    await tx.member.upsert({
      where: { memberId: memberData.memberId },
      create: memberData,
      update: {
        username: memberData.username,
        globalName: memberData.globalName,
        createdAt: memberData.createdAt,
        bannerUrl: memberData.bannerUrl,
        accentColor: memberData.accentColor,
      },
    });

    // Upsert member guild (guild-specific data)
    await tx.memberGuild.upsert({
      where: {
        member_guild: {
          memberId: memberGuildData.memberId,
          guildId: memberGuildData.guildId,
        },
      },
      create: memberGuildData,
      update: {
        status: memberGuildData.status,
        nickname: memberGuildData.nickname,
        displayName: memberGuildData.displayName,
        joinedAt: memberGuildData.joinedAt,
        displayHexColor: memberGuildData.displayHexColor,
        highestRolePosition: memberGuildData.highestRolePosition,
        avatarUrl: memberGuildData.avatarUrl,
        presenceStatus: memberGuildData.presenceStatus,
        presenceActivity: memberGuildData.presenceActivity,
        presenceUpdatedAt: memberGuildData.presenceUpdatedAt,
      },
    });

    // Create member roles if any exist
    if (memberRoleCreates.length > 0) {
      await tx.memberRole.createMany({
        data: memberRoleCreates,
        skipDuplicates: true,
      });
    }
  });

  return { memberData, memberGuildData, memberRoleCreates };
}
