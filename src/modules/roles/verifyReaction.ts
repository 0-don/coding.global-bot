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
} from '../constants.js';
import { getGuildStatusRoles } from './getGuildStatusRoles.js';

const roles = [VERIFIED, VOICE_ONLY, READ_ONLY, MUTE];

export const verifyReaction = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) => {
  // check if template
  const isTemplate = reaction.message.embeds[0]?.footer?.text;
  // check embed template a verify template
  if (isTemplate !== VERIFY_TEMPLATE) return;
  // check if reaction is from bot
  if (user.bot) return;

  // get member
  const member = await reaction.message.guild?.members.cache
    .get(user.id)
    ?.fetch();

  // if icon reaction role on user then exit
  if (
    member?.roles.cache.some((role) =>
      roles.includes(role.name as (typeof roles)[number])
    )
  )
    return;

  // get icon reaction role
  const guildStatusRoles = getGuildStatusRoles(reaction.message.guild!);

  // if icon reaction role exist exist add role to user
  guildStatusRoles[VERIFIED] && member?.roles.add(guildStatusRoles[VERIFIED]);
};
