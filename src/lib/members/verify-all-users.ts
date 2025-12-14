import { error, log } from "console";
import { Collection, CommandInteraction, Guild, GuildMember } from "discord.js";
import { prisma } from "../../prisma";
import { EVERYONE, STATUS_ROLES, VERIFIED } from "../constants";
import { chunk } from "../helpers";
import { RolesService } from "../roles/roles.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export const verifyAllUsers = async (
  guild: Guild,
  interaction?: CommandInteraction,
) => {
  const startTime = Date.now();
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

    log(`✅ ${guild.name} (${guild.id}): Processing ${totalMembers} members`);
    await interaction?.editReply({
      content: `Processing ${totalMembers} members...`,
    });

    const batchSize = 500;
    const discordBatchSize = 100;
    const memberBatches = chunk(nonBotMembers, batchSize);

    for (let i = 0; i < memberBatches.length; i++) {
      const batch = memberBatches[i];

      // Force fetch users to get banner and accent color data
      const fetchedUsers = await Promise.all(
        batch.map(async (member) => {
          try {
            return await member.user.fetch(true); // force fetch
          } catch (err) {
            error(`Failed to force fetch user ${member.id}:`, err);
            return member.user; // fallback to cached user
          }
        }),
      );

      // Prepare batch data with complete user information
      const memberUpserts = batch.map((member, index) => {
        const user = fetchedUsers[index];
        return {
          memberId: member.id,
          username: user.username,
          globalName: user.globalName,
          createdAt: user.createdAt,
          bannerUrl: user.bannerURL({ size: 1024 }) || null,
          accentColor: user.accentColor,
        };
      });

      // Get highest role position for each member
      const memberGuildUpserts = batch.map((member) => {
        const sortedRoles = Array.from(member.roles.cache.values())
          .filter((role) => role.name !== EVERYONE)
          .sort((a, b) => b.position - a.position);

        return {
          memberId: member.id,
          guildId: guild.id,
          status: true,
          nickname: member.nickname,
          displayName: member.displayName,
          joinedAt: member.joinedAt,
          displayHexColor: member.displayHexColor,
          highestRolePosition: sortedRoles[0]?.position || null,
          avatarUrl: member.avatarURL({ size: 1024 }) || null, // Guild-specific avatar
          presenceStatus: member.presence?.status || null,
          presenceActivity: member.presence?.activities[0]?.name || null,
          presenceUpdatedAt: member.presence ? new Date() : null,
        };
      });

      const memberRoleCreates = batch.flatMap((member) =>
        member.roles.cache
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
          })),
      );

      // Execute database transaction
      await prisma.$transaction(async (tx) => {
        // Delete existing roles for this batch
        await tx.memberRole.deleteMany({
          where: {
            memberId: { in: batch.map((m) => m.id) },
            guildId: guild.id,
          },
        });

        // Upsert members with complete user data
        for (const memberData of memberUpserts) {
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
        }

        // Upsert member guild data
        for (const memberGuildData of memberGuildUpserts) {
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
        }

        // Create role assignments
        await tx.memberRole.createMany({
          data: memberRoleCreates,
          skipDuplicates: true,
        });
      });

      // Handle verified role assignments
      if (guildStatusRoles[VERIFIED]) {
        const verifiedRoleId = guildStatusRoles[VERIFIED]!.id;
        const discordBatches = chunk(batch, discordBatchSize);

        for (let j = 0; j < discordBatches.length; j++) {
          const discordBatch = discordBatches[j];

          await Promise.all(
            discordBatch.map(async (member) => {
              if (!member.roles.cache.has(verifiedRoleId)) {
                const roleToAdd = member.guild.roles.cache.get(verifiedRoleId);
                if (!roleToAdd || !roleToAdd.editable) return;

                try {
                  return await member.roles.add(verifiedRoleId);
                } catch (err) {
                  error(
                    `❌ ${guild.name} (${guild.id}): Failed to add role to ${member.user.username} (${member.id})`,
                  );
                }
              }
              return Promise.resolve();
            }),
          );

          const processedCount = i * batchSize + (j + 1) * discordBatchSize;
          const progressPercent = Math.min(
            100,
            Math.round((processedCount / totalMembers) * 100),
          );

          log(
            `✅ ${guild.name} (${guild.id}): ${progressPercent}% (${processedCount}/${totalMembers})`,
          );
        }
      }

      const processedMembers = Math.min((i + 1) * batchSize, totalMembers);
      const progressMessage = `Processed ${processedMembers}/${totalMembers} members (${Math.round(
        (processedMembers / totalMembers) * 100,
      )}%)`;

      await interaction?.editReply({ content: progressMessage });
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log(`🎉 Completed verification for ${guild.name} (${guild.id})`);
    log(`⏱️ Total time: ${duration}s`);
    return allMembers;
  } catch (err) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    error(`❌ Error in ${guild.name} (${guild.id}) after ${duration}s:`, err);
    throw err;
  }
};
