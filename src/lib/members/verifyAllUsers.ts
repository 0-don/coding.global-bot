import { error, log } from "console";
import { CommandInteraction, Guild } from "discord.js";
import { prisma } from "../../prisma.js";
import { EVERYONE, STATUS_ROLES, VERIFIED } from "../constants.js";
import { chunk } from "../helpers.js";
import { RolesService } from "../roles/Roles.service.js";

export const verifyAllUsers = async (
  guild: Guild,
  interaction?: CommandInteraction,
) => {
  const startTime = Date.now();
  try {
    log(`🚀 Starting verification for ${guild.name} (${guild.id})`);

    // Fetch all required data at once
    const [guildData, allMembers, allRoles] = await Promise.all([
      prisma.guild.upsert({
        where: { guildId: guild.id },
        create: { guildId: guild.id, guildName: guild.name },
        update: { guildName: guild.name },
      }),
      guild.members.fetch(),
      guild.roles.fetch(),
    ]);

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

      // Prepare batch data
      const memberUpserts = batch.map((member) => ({
        memberId: member.id,
        username: member.user.username,
      }));

      const memberGuildUpserts = batch.map((member) => ({
        memberId: member.id,
        guildId: guild.id,
        status: true,
      }));

      const memberRoleCreates = batch.flatMap((member) =>
        member.roles.cache
          .filter((role) => role.name !== EVERYONE && role.editable)
          .map((role) => ({
            roleId: role.id,
            name: role.name,
            memberId: member.id,
            guildId: guild.id,
          })),
      );

      // Execute database transaction
      await prisma.$transaction([
        prisma.memberRole.deleteMany({
          where: {
            memberId: { in: batch.map((m) => m.id) },
            guildId: guild.id,
          },
        }),
        prisma.member.createMany({
          data: memberUpserts,
          skipDuplicates: true,
        }),
        prisma.memberGuild.createMany({
          data: memberGuildUpserts,
          skipDuplicates: true,
        }),
        prisma.memberRole.createMany({
          data: memberRoleCreates,
          skipDuplicates: true,
        }),
      ]);

      // Handle verified role assignments
      if (guildStatusRoles[VERIFIED]) {
        const verifiedRoleId = guildStatusRoles[VERIFIED]!.id;
        const discordBatches = chunk(batch, discordBatchSize);

        for (let j = 0; j < discordBatches.length; j++) {
          const discordBatch = discordBatches[j];

          await Promise.all(
            discordBatch.map(async (member) => {
              if (!member.roles.cache.has(verifiedRoleId)) {
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
