import { SlashCommandBuilder } from '@discordjs/builders';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';
import { prisma } from '../prisma.js';
import { VERIFIED, statusRoles } from '../utils/constants.js';
import { upsertDbMember } from '../utils/members/upsertDbMember.js';
import { getGuildStatusRoles } from '../utils/roles/getGuildStatusRoles.js';
import { recreateMemberDbRoles } from '../utils/roles/recreateMemberDbRoles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify-all-users')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName },
      update: { guildName },
    });

    // create a guild role key object pair
    let guildStatusRoles = getGuildStatusRoles(interaction.guild);

    // if one of the roles is missing, return
    if (statusRoles.some((role) => !guildStatusRoles[role])) {
      const content = statusRoles
        .map(
          (role) =>
            `${role}: ${new Boolean(!!guildStatusRoles[role]).toString()}`
        )
        .join('\n');
      return await interaction.editReply({ content });
    }

    let i = 1;
    const members = await interaction.guild.members.fetch();

    await interaction.editReply({
      content: `updating user count:${members.size}`,
    });

    const rolesWithoutUnverified = [...statusRoles].filter(
      (role) => role !== 'unverified'
    );

    // loop over all guild members
    for (let memberCollection of members) {
      // get the user from map collection
      let member = memberCollection[1];
      // refetch user if some roles were reasinged

      if (i % Math.floor((members.size / 100) * 10) === 0) {
        await interaction.editReply(
          `Members: ${i}/${members.size} ${member.user.username}`
        );
      }

      log(`${i}/${members.size} user: ${member.user.username}`);
      i++;

      if (member.user.bot) continue;

      // check if user exists in db
      await upsertDbMember(member, 'join');

      // recreate roles delete old add new
      await recreateMemberDbRoles(member);

      // if one of the status roles is on user, continue
      if (
        rolesWithoutUnverified.some((role) =>
          member.roles.cache.has(guildStatusRoles[role]!.id)
        )
      )
        continue;

      // verify user
      guildStatusRoles[VERIFIED] &&
        (await member.roles.add(guildStatusRoles[VERIFIED].id));
    }
    return (interaction.channel as TextChannel)?.send({
      content: `Verified all users (${members.size}) in ${interaction.guild.name}`,
    });
  },
};
