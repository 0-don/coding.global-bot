import type { Guild, Role } from 'discord.js';
import { statusRoles } from '../constants.js';

export const getGuildStatusRoles = (guild: Guild) => {
  let guildStatusRoles: {
    [x: string]: Role | undefined;
  } = {};
  //check for verified roles "verified", "voiceOnly", "readOnly", "mute", "unverified"
  for (let role of statusRoles)
    guildStatusRoles[role] = guild?.roles.cache.find(
      ({ name }) => name === role
    );
  return guildStatusRoles;
};
