import type { GuildMember, PartialGuildMember } from 'discord.js';
import { joinRole } from '../utils/members/joinRole';
import { updateDbRoles } from '../utils/roles/updateDbRoles';
import { updateStatusRoles } from '../utils/roles/updateStatusRoles';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember
  ) {
    // if rules acepted add join role
    if (oldMember.pending && !newMember.pending) await joinRole(newMember);

    // update db roles
    await updateDbRoles(oldMember, newMember);
    
    // update status roles
    await updateStatusRoles(oldMember, newMember);
  },
};
