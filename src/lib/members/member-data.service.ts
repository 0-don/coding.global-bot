import type { GuildMember, User } from "discord.js";
import { prisma } from "../../prisma";
import { EVERYONE } from "../constants";

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
        avatarUrl: memberData.avatarUrl,
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
        bannerUrl: memberGuildData.bannerUrl,
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

function prepareMemberData(user: User) {
  return {
    memberId: user.id,
    username: user.username,
    globalName: user.globalName,
    createdAt: user.createdAt,
    avatarUrl: user.avatarURL({ size: 1024 }) || null,
    bannerUrl: user.bannerURL({ size: 1024 }) || null,
    accentColor: user.accentColor,
  };
}

function prepareMemberGuildData(member: GuildMember) {
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
    bannerUrl: member.bannerURL({ size: 1024 }) || null,
    presenceStatus: member.presence?.status || null,
    presenceActivity: member.presence?.activities[0]?.name || null,
    presenceUpdatedAt: member.presence ? new Date() : null,
  };
}

function prepareMemberRolesData(member: GuildMember) {
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
