import type { GuildMember, User } from "discord.js";
import { prisma } from "../../prisma";
import { EVERYONE } from "../constants";

export async function updateCompleteMemberData(member: GuildMember) {
  try {
    const user = await member.user.fetch(true);
    const guildMember = await member.fetch(true);

    const memberData = prepareMemberData(user);
    const memberGuildData = prepareMemberGuildData(guildMember);
    const memberRoleCreates = prepareMemberRolesData(guildMember);

    await prisma.$transaction(async (tx) => {
      // Delete existing roles to avoid duplicates
      await tx.memberRole.deleteMany({
        where: { memberId: member.id, guildId: member.guild.id },
      });

      // Upsert member (global user data)
      await tx.member.upsert({
        where: { memberId: memberData.memberId },
        create: memberData,
        update: memberData,
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
        update: memberGuildData,
      });

      // Create member roles if any exist
      if (memberRoleCreates.length > 0) {
        await tx.memberRole.createMany({
          data: memberRoleCreates,
          skipDuplicates: true,
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Connect Timeout Error")
    ) {
      return;
    }
    console.error(
      `Failed to update complete member data for ${member.id} ${member.user.username}:`,
      error,
    );
  }
}

function prepareMemberData(user: User) {
  return {
    memberId: user.id,
    username: user.username,
    globalName: user.globalName,
    discriminator: user.discriminator,
    bot: user.bot,
    system: user.system,
    createdAt: user.createdAt,
    avatarUrl: user.avatarURL({ size: 1024 }) || null,
    bannerUrl: user.bannerURL({ size: 1024 }) || null,
    accentColor: user.accentColor,
    avatarDecorationUrl: user.avatarDecorationURL() || null,
    flags: user.flags?.bitfield || null,
    hexAccentColor: user.hexAccentColor || null,
    avatarDecorationData: user.avatarDecorationData
      ? JSON.parse(JSON.stringify(user.avatarDecorationData))
      : null,
    collectibles: user.collectibles
      ? JSON.parse(JSON.stringify(user.collectibles))
      : null,
    primaryGuild: user.primaryGuild
      ? JSON.parse(JSON.stringify(user.primaryGuild))
      : null,
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
    avatarDecorationUrl: member.avatarDecorationURL() || null,
    presenceStatus: member.presence?.status || null,
    presenceActivity: member.presence?.activities[0]?.name || null,
    presenceUpdatedAt: member.presence ? new Date() : null,
    pending: member.pending,
    premiumSince: member.premiumSince,
    communicationDisabledUntil: member.communicationDisabledUntil,
    flags: member.flags.bitfield,
    displayColor: member.displayColor || null,
    avatarDecorationData: member.avatarDecorationData
      ? JSON.parse(JSON.stringify(member.avatarDecorationData))
      : null,
    bannable: member.bannable,
    kickable: member.kickable,
    manageable: member.manageable,
    moderatable: member.moderatable,
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
