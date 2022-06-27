import type { GuildMember, PartialGuildMember } from 'discord.js';

export default {
  name: 'guildMemberUpdate',
  once: false,
  execute(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember
  ) {
    oldMember;
    newMember;
  },
};
