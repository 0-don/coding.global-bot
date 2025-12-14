import { error, log } from "console";
import { Collection, CommandInteraction, Guild, GuildMember } from "discord.js";
import { prisma } from "../../prisma";
import { EVERYONE, STATUS_ROLES, VERIFIED } from "../constants";
import { RolesService } from "../roles/roles.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Global state tracker for verification progress
interface VerificationState {
  guildId: string;
  lastProcessedIndex: number;
  totalMembers: number;
  startTime: number;
  isRunning: boolean;
}

const verificationStates = new Map<string, VerificationState>();

export function getVerificationState(guildId: string): VerificationState | undefined {
  return verificationStates.get(guildId);
}

export function clearVerificationState(guildId: string): void {
  verificationStates.delete(guildId);
}

async function fetchMembersWithRetry(
  guild: Guild,
  maxRetries = 3,
): Promise<Collection<string, GuildMember>> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`📥 Fetching members (attempt ${attempt}/${maxRetries})...`);
      return await guild.members.fetch();
    } catch (err: any) {
      lastError = err;

      if (err.name === "GatewayRateLimitError") {
        const retryAfter = err.data?.retry_after || 30;
        const waitTime = Math.ceil(retryAfter * 1000);

        error(
          `⚠️ Rate limited! Waiting ${retryAfter}s before retry ${attempt}/${maxRetries}...`,
        );

        if (attempt < maxRetries) {
          await sleep(waitTime);
        }
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

async function processSingleMember(
  member: GuildMember,
  guild: Guild,
  guildStatusRoles: Record<string, any>,
): Promise<void> {
  let attempt = 0;

  // Retry indefinitely until success
  while (true) {
    attempt++;
    try {
      // Force fetch user to get banner and accent color data
      const user = await member.user.fetch(true);

      // Prepare member data
      const memberData = {
        memberId: member.id,
        username: user.username,
        globalName: user.globalName,
        createdAt: user.createdAt,
        bannerUrl: user.bannerURL({ size: 1024 }) || null,
        accentColor: user.accentColor,
      };

      // Get highest role position
      const sortedRoles = Array.from(member.roles.cache.values())
        .filter((role) => role.name !== EVERYONE)
        .sort((a, b) => b.position - a.position);

      const memberGuildData = {
        memberId: member.id,
        guildId: guild.id,
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

      const memberRoleCreates = member.roles.cache
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
          guildId: guild.id,
        }));

      // Execute database transaction
      await prisma.$transaction(async (tx) => {
        // Delete existing roles for this member
        await tx.memberRole.deleteMany({
          where: {
            memberId: member.id,
            guildId: guild.id,
          },
        });

        // Upsert member with complete user data
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

        // Upsert member guild data
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

        // Create role assignments
        if (memberRoleCreates.length > 0) {
          await tx.memberRole.createMany({
            data: memberRoleCreates,
            skipDuplicates: true,
          });
        }
      });

      // Handle verified role assignment
      if (guildStatusRoles[VERIFIED]) {
        const verifiedRoleId = guildStatusRoles[VERIFIED]!.id;
        if (!member.roles.cache.has(verifiedRoleId)) {
          const roleToAdd = member.guild.roles.cache.get(verifiedRoleId);
          if (roleToAdd && roleToAdd.editable) {
            await member.roles.add(verifiedRoleId);
          }
        }
      }

      // Success - exit retry loop
      return;
    } catch (err: any) {
      if (err.name === "GatewayRateLimitError" || err.code === 50001) {
        const retryAfter = err.data?.retry_after || 5;
        const waitTime = Math.ceil(retryAfter * 1000);

        error(
          `⚠️ Rate limited on member ${member.user.username}! Waiting ${retryAfter}s (attempt ${attempt})...`,
        );

        await sleep(waitTime);
      } else {
        error(
          `❌ Failed to process ${member.user.username} (${member.id}) on attempt ${attempt}:`,
          err,
        );
        await sleep(2000); // Wait 2s before retry for other errors
      }
      // Continue loop to retry
    }
  }
}

export const verifyAllUsers = async (
  guild: Guild,
  interaction?: CommandInteraction,
) => {
  // Check if already running
  let state = verificationStates.get(guild.id);
  if (state && state.isRunning) {
    const message = `Verification already running. Progress: ${state.lastProcessedIndex}/${state.totalMembers}`;
    log(message);
    await interaction?.editReply({ content: message });
    return;
  }

  const startTime = state?.startTime || Date.now();

  try {
    log(`🚀 Starting verification for ${guild.name} (${guild.id})`);

    // Fetch guild data first
    await prisma.guild.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, guildName: guild.name },
      update: { guildName: guild.name },
    });

    // Fetch members separately with retry logic
    const allMembers = await fetchMembersWithRetry(guild);

    const guildStatusRoles = RolesService.getGuildStatusRoles(guild);

    if (STATUS_ROLES.some((role) => !guildStatusRoles[role])) {
      const content = STATUS_ROLES.map(
        (role) => `${role}: ${!!guildStatusRoles[role]}`,
      ).join("\n");
      error(`❌ ${guild.name} (${guild.id}): Missing roles:\n${content}`);
      await interaction?.editReply({ content });
      throw new Error("Missing required status roles");
    }

    const nonBotMembers = Array.from(allMembers.values()).filter(
      (m) => !m.user.bot,
    );
    const totalMembers = nonBotMembers.length;

    // Initialize or update state
    const startIndex = state?.lastProcessedIndex || 0;
    state = {
      guildId: guild.id,
      lastProcessedIndex: startIndex,
      totalMembers,
      startTime,
      isRunning: true,
    };
    verificationStates.set(guild.id, state);

    const resumeMessage = startIndex > 0
      ? ` (resuming from ${startIndex}/${totalMembers})`
      : "";

    log(`✅ ${guild.name} (${guild.id}): Processing ${totalMembers} members${resumeMessage}`);
    await interaction?.editReply({
      content: `Processing ${totalMembers} members${resumeMessage}...`,
    });

    // Process members one by one
    for (let i = startIndex; i < totalMembers; i++) {
      const member = nonBotMembers[i];

      await processSingleMember(member, guild, guildStatusRoles);

      // Update state after each member
      state.lastProcessedIndex = i + 1;
      verificationStates.set(guild.id, state);

      // Update progress after every member
      const progressPercent = Math.round(((i + 1) / totalMembers) * 100);
      const progressMessage = `Processed ${i + 1}/${totalMembers} members (${progressPercent}%)`;

      log(`✅ ${guild.name} (${guild.id}): ${progressMessage}`);
      await interaction?.editReply({ content: progressMessage });
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log(`🎉 Completed verification for ${guild.name} (${guild.id})`);
    log(`⏱️ Total time: ${duration}s`);

    // Clear state on completion
    verificationStates.delete(guild.id);

    return allMembers;
  } catch (err) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    error(`❌ Error in ${guild.name} (${guild.id}) after ${duration}s:`, err);

    // Keep state so it can be resumed
    if (state) {
      state.isRunning = false;
      verificationStates.set(guild.id, state);
    }

    throw err;
  }
};
