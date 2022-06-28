import type { GuildMember } from 'discord.js';
import { joinRole } from '../utils/members/joinRole';
import { updateUserCount } from '../utils/members/updateUserCount';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {

    await joinRole(member);
    await updateUserCount(member);
  },
};
