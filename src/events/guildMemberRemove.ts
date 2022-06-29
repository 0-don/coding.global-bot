import type { GuildMember } from 'discord.js';
import { updateUserCount } from '../utils/members/updateUserCount';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member: GuildMember) {
    // update user count channel
    await updateUserCount(member);
  },
};
