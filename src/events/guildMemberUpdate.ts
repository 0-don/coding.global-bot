import type { Event } from '../types';
import { joinRole } from '../utils/members/joinRole';
import { updateDbRoles } from '../utils/roles/updateDbRoles';
import { updateStatusRoles } from '../utils/roles/updateStatusRoles';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    // if rules acepted add join role
    if (oldMember.pending && !newMember.pending)
      await joinRole(newMember, 'verified');

    // update db roles
    await updateDbRoles(oldMember, newMember);

    // update status roles
    await updateStatusRoles(oldMember, newMember);
  },
} as Event<'guildMemberUpdate'>;
