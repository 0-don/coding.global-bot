import { log } from "console";
import type { CommandInteraction, TextChannel } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { Discord, Slash } from "discordx";
import { STATUS_ROLES, VERIFIED } from "../../lib/constants.js";
import { MembersService } from "../../lib/members/Members.service.js";

import { RolesService } from "../../lib/roles/Roles.service.js";
import { recreateMemberDbRoles } from "../../lib/roles/recreateMemberDbRoles.js";
import { prisma } from "../../prisma.js";

@Discord()
export class VerifyAllUsers {
  @Slash({
    name: "verify-all-users",
    description: "verify all users in the server",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async verifyAllUsers(interaction: CommandInteraction) {
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
    let guildStatusRoles = RolesService.getGuildStatusRoles(interaction.guild);

    // if one of the roles is missing, return
    if (STATUS_ROLES.some((role) => !guildStatusRoles[role])) {
      const content = STATUS_ROLES.map((role) => `${role}: ${new Boolean(!!guildStatusRoles[role]).toString()}`).join(
        "\n",
      );
      return await interaction.editReply({ content });
    }

    let i = 1;
    const members = await interaction.guild.members.fetch();

    await interaction.editReply({
      content: `updating user count:${members.size}`,
    });

    const rolesWithoutUnverified = [...STATUS_ROLES].filter((role) => role !== "Unverified");

    // loop over all guild members
    for (let memberCollection of members) {
      // get the user from map collection
      let member = memberCollection[1];
      // refetch user if some roles were reasinged

      if (i % Math.floor((members.size / 100) * 10) === 0) {
        await interaction.editReply(`Members: ${i}/${members.size} ${member.user.username}`);
      }

      log(`${i}/${members.size} user: ${member.user.username}`);
      i++;

      if (member.user.bot) continue;

      // check if user exists in db
      await MembersService.upsertDbMember(member, "join");

      // recreate roles delete old add new
      await recreateMemberDbRoles(member);

      // if one of the status roles is on user, continue
      if (rolesWithoutUnverified.some((role) => member.roles.cache.has(guildStatusRoles[role]!.id))) continue;

      // verify user
      guildStatusRoles[VERIFIED] && (await member.roles.add(guildStatusRoles[VERIFIED].id));
    }
    return (interaction.channel as TextChannel)?.send({
      content: `Verified all users (${members.size}) in ${interaction.guild.name}`,
    });
  }
}
