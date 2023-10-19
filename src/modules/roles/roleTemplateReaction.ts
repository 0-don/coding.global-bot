import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { ROLE_TEMPLATE } from '../constants.js';

export const switchRoleFromTemplate = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  type: 'add' | 'remove'
) => {
  // check if reaction is from bot and its role template
  const isTemplate = reaction.message.embeds[0]?.footer?.text;
  if (isTemplate !== ROLE_TEMPLATE) return;
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
    await member.roles.add(role);
    try {
      await member.send(`role added: **${roleString}**`);
    } catch (_) {}
  } else {
    if (!memberRoleExist) return;
    await member.roles.remove(role);
    try {
      await member.send(`role removed: **${roleString}**`);
    } catch (_) {}
  }
};
