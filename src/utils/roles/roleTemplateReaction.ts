import type {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';

export const switchRoleFromTemplate = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  type: 'add' | 'remove'
) => {
  // fetch reaction status and roles
  await reaction.fetch();

  // check if reaction is from bot and its role template
  const isTemplate = reaction.message.embeds[0]?.footer?.text;
  if (isTemplate !== 'role template') return;
  if (user.id === reaction.message.author?.id) return;

  // @ts-ignore
  const roleString = reaction._emoji.name;

  // get user and role
  const member = reaction.message.guild?.members.cache.get(user.id);
  const role = reaction.message.guild?.roles.cache.find(
    ({ name }) => name === roleString
  );

  // check if variables exist or role editable
  if (!member || !role || !role.editable) return;

  await member.fetch();

  // check if roles already on user, so not to add twice
  const memberRoleExist = member.roles.cache.some(
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
