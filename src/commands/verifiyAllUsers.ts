import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import { statusRoles, VERIFIED } from '../utils/constants';
import { upsertDbMember } from '../utils/members/upsertDbMember';
import { getGuildStatusRoles } from '../utils/roles/getGuildStatusRoles';
import { recreateMemberDbRoles } from '../utils/roles/recreateMemberDbRoles';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('verify-all-users')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName },
      update: { guildName },
    });

    // create a guild role key object pair
    let guildStatusRoles = getGuildStatusRoles(interaction.guild);

    await interaction.deferReply({ ephemeral: true });

    // if one of the roles is missing, return
    if (statusRoles.some((role) => !guildStatusRoles[role])) {
      const content = statusRoles
        .map(
          (role) =>
            `${role}: ${new Boolean(!!guildStatusRoles[role]).toString()}`
        )
        .join('\n');
      return interaction.editReply({ content });
    }

    let i = 1;
    const members = await interaction.guild.members.fetch();

    interaction.editReply({
      content: `updating user count:${members.size}`,
    });

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
        statusRoles.some((role) =>
          member.roles.cache.has(guildStatusRoles[role]!.id)
        )
      )
        continue;

      // verify user
      guildStatusRoles[VERIFIED] &&
        (await member.roles.add(guildStatusRoles[VERIFIED].id));
    }
    return interaction.channel?.send({
      content: `Verified all users (${members.size}) in ${interaction.guild.name}`,
    });
  },
};
