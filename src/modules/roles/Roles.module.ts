import {
  Guild,
  GuildMember,
  MessageReaction,
  PartialGuildMember,
  PartialMessageReaction,
  PartialUser,
  Role,
  User,
} from "discord.js";
import { StatusRoles } from "../../types/index.js";
import {
  MUTE,
  READ_ONLY,
  VERIFIED,
  VERIFY_TEMPLATE,
  VOICE_ONLY,
  statusRoles,
} from "../constants.js";

const roles = [VERIFIED, VOICE_ONLY, READ_ONLY, MUTE];

export class RolesModule {
  static async joinRole(
    member: GuildMember | PartialGuildMember,
    role: StatusRoles,
  ) {
    // dont add bots to the list
    if (member.user.bot) return;

    await member.fetch();

    // this status role will be given on new memeber join if he has no role
    const addRole = member.guild.roles.cache.find(({ name }) => name === role);

    // if status role on user then exit
    if (
      member.roles.cache.some((role) =>
        statusRoles.includes(role.name as StatusRoles),
      ) ||
      !addRole
    )
      return;

    // if first time member add unverified role
    await member.roles.add(addRole);
  }

  static getGuildStatusRoles(guild: Guild) {
    let guildStatusRoles: {
      [x: string]: Role | undefined;
    } = {};
    //check for verified roles "verified", "voiceOnly", "readOnly", "mute", "unverified"
    for (let role of statusRoles)
      guildStatusRoles[role] = guild?.roles.cache.find(
        ({ name }) => name === role,
      );
    return guildStatusRoles;
  }

  static async verifyReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
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
        roles.includes(role.name as (typeof roles)[number]),
      )
    )
      return;

    // get icon reaction role
    const guildStatusRoles = RolesModule.getGuildStatusRoles(
      reaction.message.guild!,
    );

    // if icon reaction role exist exist add role to user
    guildStatusRoles[VERIFIED] && member?.roles.add(guildStatusRoles[VERIFIED]);
  }
}
