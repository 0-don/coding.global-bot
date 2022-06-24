import {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  Permissions,
} from 'discord.js';

const adminPermissions = [
  Permissions.FLAGS.KICK_MEMBERS,
  Permissions.FLAGS.BAN_MEMBERS,
];

export const switchRoleFromTemplate = (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  type: 'add' | 'remove'
) => {
  const isTemplate = reaction.message.embeds[0]?.footer?.text;
  if (!isTemplate) return;
  if (user.id === reaction.message.author?.id) return;

  // @ts-ignore
  const roleString = reaction._emoji.name;

  const member = reaction.message.guild?.members.cache.get(user.id);
  const role = reaction.message.guild?.roles.cache.find(
    ({ name }) => name === roleString
  );

  if (!member || !role) return;
  if (role.permissions.has(adminPermissions)) return;

  const memberRoleExist = member.roles.cache.find(
    ({ name }) => name === roleString
  );

  if (type === 'add') {
    if (memberRoleExist) return;
    member.roles.add(role);
    member.send(`role added: **${roleString}**`);
  } else {
    if (!memberRoleExist) return;
    member.roles.remove(role);
    member.send(`role removed: **${roleString}**`);
  }
};
