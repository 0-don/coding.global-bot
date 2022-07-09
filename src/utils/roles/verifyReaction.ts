import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import {
  MUTE,
  READ_ONLY,
  VERIFIED,
  VERIFY_TEMPLATE,
  VOICE_ONLY,
} from '../constants';
import { getGuildStatusRoles } from './getGuildStatusRoles';

const roles = [VERIFIED, VOICE_ONLY, READ_ONLY, MUTE];

export const verifyReaction = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) => {
  const isTemplate = reaction.message.embeds[0]?.footer?.text;
  if (isTemplate !== VERIFY_TEMPLATE) return;
  if (user.id === reaction.message.author?.id) return;
  if (user.bot) return;

  const member = await reaction.message.guild?.members.cache
    .get(user.id)
    ?.fetch();

  // if status role on user then exit

  if (member?.roles.cache.some((role) => roles.includes(role.name as any)))
    return;

  let guildStatusRoles = getGuildStatusRoles(reaction.message.guild!);

  guildStatusRoles[VERIFIED] && member?.roles.add(guildStatusRoles[VERIFIED]);
};
