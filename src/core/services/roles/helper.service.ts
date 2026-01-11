import { prisma } from "@/prisma";
import { HELPER_RANKING, HELPER_ROLES } from "@/shared/config/roles";
import { ConfigValidator } from "@/shared/config/validator";
import { Message, TextChannel } from "discord.js";

export interface HandleHelperReactionParams {
  threadId: string;
  threadOwnerId: string | null;
  helperId: string;
  thankerUserId: string;
  guildId: string;
  message: Message;
}

export class HelperService {
  private static _helperSystemWarningLogged = false;

  static async handleHelperReaction(
    params: HandleHelperReactionParams,
  ): Promise<boolean> {
    if (params.threadOwnerId !== params.thankerUserId) return false;
    if (params.helperId === params.thankerUserId) return false;

    const isHelpedThread = await prisma.memberHelper.findFirst({
      where: { threadId: params.threadId, threadOwnerId: params.threadOwnerId },
    });
    if (isHelpedThread) return false;

    await prisma.memberHelper.create({
      data: {
        memberId: params.helperId,
        guildId: params.guildId,
        threadId: params.threadId,
        threadOwnerId: params.threadOwnerId,
      },
    });

    await HelperService.helperRoleChecker(params.message);
    return true;
  }

  static async helperRoleChecker(message: Message<boolean>) {
    if (!ConfigValidator.isFeatureEnabled("HELPER_ROLES")) {
      if (!this._helperSystemWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Helper Role System",
          "HELPER_ROLES",
        );
        this._helperSystemWarningLogged = true;
      }
      return;
    }

    const guildMember = message.member!.partial
      ? await message.member!.fetch()
      : message.member!;
    const memberRoles = guildMember.roles.cache;
    const helpCount = await prisma.memberHelper.count({
      where: { memberId: guildMember.id },
    });

    //check if user has helper role
    const hasHelperRole = memberRoles.some((role) =>
      HELPER_ROLES.includes(role.name as (typeof HELPER_ROLES)[number]),
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
        } 🎉`,
      );
    }
  }
}
