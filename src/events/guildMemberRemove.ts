import type { GuildMember } from 'discord.js';
import { updateMemberCount } from '../utils/members/updateMemberCount';
import { upsertDbMember } from '../utils/members/upsertDbMember';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member: GuildMember) {
    // create or update user with his roles
    await upsertDbMember(member, 'leave');

    // update user count channel
    await updateMemberCount(member);
  },
};
