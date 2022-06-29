import type { GuildMember, PartialGuildMember } from 'discord.js';
import { updateDbRoles } from '../utils/roles/updateDbRoles';
import { updateStatusRoles } from '../utils/roles/updateStatusRoles';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember
  ) {
    // update db roles
    await updateDbRoles(oldMember, newMember);
    // update status roles
    await updateStatusRoles(oldMember, newMember);
  },
};
