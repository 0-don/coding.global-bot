import type { GuildMember, PartialGuildMember } from 'discord.js';

export default {
  name: 'guildMemberUpdate',
  once: false,
  execute(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember
  ) {
    oldMember.roles.cache.forEach((role) => {
      console.log('old', role.name);
    });
    newMember.roles.cache.forEach((role) => {
      console.log('new', role.name);
    });
  },
};
