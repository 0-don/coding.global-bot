import { SlashCommandBuilder } from '@discordjs/builders';
import { log } from 'console';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import { statusRoles, VERIFIED } from '../utils/constants';
import { upsertDbMember } from '../utils/members/upsertDbMember';
import { createUserDbRoles } from '../utils/roles/createUserDbRoles';
import { getGuildStatusRoles } from '../utils/roles/getGuildStatusRoles';

export default {
  data: new SlashCommandBuilder()
    .setName('verify-all-users')
    .setDescription('verify all users in the server')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers & PermissionFlagsBits.BanMembers
    ),
  async execute(interaction: CommandInteraction<CacheType>) {
    await interaction.guild?.members.fetch();
    await interaction.guild?.roles.fetch();
    const members = interaction.guild?.members.cache;

    if (!members) return;

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
    const memberCount = interaction.guild.members.cache.filter(
      (member) => !member.user.bot
    ).size;
    // loop over all guild members
    for (let memberCollection of members) {
      // get the user from map collection
      const member = memberCollection[1];

      log(member.user.username);

      // check if user exists in db
      await upsertDbMember(member, 'join');

      // refetch user if some roles were reasinged
      await member.fetch();

      // create user roles in db if missing
      await createUserDbRoles(member);

      // if one of the status roles is on user, continue
      if (
        statusRoles.some((role) => {
          member.roles.cache.has(guildStatusRoles[role]!.id);
        }) ||
        member.user.bot
      )
        continue;

      // verify user
      await member.roles.add(guildStatusRoles[VERIFIED]!.id);

      interaction.editReply({
        content: `${i}/${memberCount} user: ${member.user.username}`,
      });
      i++;
    }
  },
};
