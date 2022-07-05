import type { GuildMember } from 'discord.js';
import { guildMemberRemoveDb } from '../utils/members/guildMemberRemoveDb';
import { updateUserCount } from '../utils/members/updateUserCount';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member: GuildMember) {
    // add leave event in db
    await guildMemberRemoveDb(member);

    // update user count channel
    await updateUserCount(member);
  },
};
