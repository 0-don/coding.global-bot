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
import { prisma } from "../../prisma.js";
import { StatusRoles } from "../../types/index.js";
import {
  JAIL,
  STATUS_ROLES,
  VERIFIED,
  VERIFY_TEMPLATE,
  VOICE_ONLY,
} from "../constants.js";

export class RolesService {
  static getGuildStatusRoles(guild: Guild) {
    let guildStatusRoles: {
      [x: string]: Role | undefined;
    } = {};
    //check for verified roles "verified", "voiceOnly", "readOnly", "mute", "unverified"
    for (let role of STATUS_ROLES)
      guildStatusRoles[role] = guild?.roles.cache.find(
        ({ name }) => name === role
      );
    return guildStatusRoles;
  }

  static async verify(
    member: GuildMember | PartialGuildMember,
    role: StatusRoles
  ) {
    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(member.guild);

    // if icon reaction role exist exist add role to user
    guildStatusRoles[role] && (await member.roles.add(guildStatusRoles[role]!));
  }

  static async verifyReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
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

    const memberDbRoles = await prisma.memberRole.findMany({
      where: { memberId: user.id },
    });

    const guildRoles = reaction.message.guild?.roles.cache.filter((role) =>
      memberDbRoles.some((dbRole) => dbRole.roleId === role.id)
    );

    // if jail role exist then exit
    if (guildRoles?.find(({ name }) => name === JAIL)) return;

    // if icon reaction role on user then exit
    if (
      member?.roles.cache.some((role) =>
        [VERIFIED, JAIL, VOICE_ONLY].includes(role.name as any)
      )
    )
      return;

    // get icon reaction role
    const guildStatusRoles = RolesService.getGuildStatusRoles(
      reaction.message.guild!
    );

    // if icon reaction role exist exist add role to user
    guildStatusRoles[VERIFIED] &&
      member?.roles.add(guildStatusRoles[VERIFIED] as Role);
  }
}
