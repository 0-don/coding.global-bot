import { Message, TextChannel } from "discord.js";
import { prisma } from "../../prisma.js";
import { HELPER_RANKING, HELPER_ROLES } from "../constants.js";

export class HelperService {
  static async helperRoleChecker(message: Message<boolean>) {
    const guildMember = await message.member!.fetch();
    const memberRoles = guildMember.roles.cache;
    const helpCount = await prisma.memberHelper.count({
      where: { memberId: guildMember.id },
    });

    //check if user has helper role
    const hasHelperRole = memberRoles.some((role) =>
      HELPER_ROLES.includes(role.name as (typeof HELPER_ROLES)[number])
    );
    if (!hasHelperRole) return;

    //remove roles
    for (const role of memberRoles.values()) {
      if (HELPER_ROLES.includes(role.name as (typeof HELPER_ROLES)[number])) {
        try {
          await guildMember.roles.remove(role);
        } catch (_) {}
      }
    }

    //add role
    const helperRole = HELPER_RANKING.find((role) => role.points <= helpCount);
    if (helperRole) {
      try {
        const roleToAdd = memberRoles.get(helperRole.name);
        if (!roleToAdd || !roleToAdd.editable) return;

        await guildMember.roles.add(helperRole.name);
      } catch (_) {}
      (message.channel as TextChannel).send(
        `Congratulations ${guildMember.toString()} you are now ${
          helperRole.name
        } 🎉`
      );
    }
  }
}
