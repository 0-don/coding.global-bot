import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { EVERYONE } from "../lib/constants.js";
import { updateNickname } from "../lib/members/save-nickname.js";
import { RolesService } from "../lib/roles/roles.service.js";
import { prisma } from "../prisma.js";

@Discord()
export class GuildMemberUpdate {
  @On()
  async guildMemberUpdate([oldMember, newMember]: ArgsOf<"guildMemberUpdate">) {
    const guildRoles = newMember.guild.roles.cache;
    const memberDbRoles = await prisma.memberRole.findMany({
      where: { memberId: newMember.id, guildId: newMember.guild.id },
    });

    // get old roles as string[]
    const oldRoles = oldMember.roles.cache
      .filter(({ name }) => name !== EVERYONE)
      .map((role) => role);
    // get new roles as string[]
    const newRoles = newMember.roles.cache
      .filter(({ name }) => name !== EVERYONE)
      .map((role) => role);

    // update db roles
    await RolesService.updateDbRoles({
      oldMember,
      newMember,
      oldRoles,
      newRoles,
      guildRoles,
      memberDbRoles,
    });

    // // update status roles
    await RolesService.updateStatusRoles({
      oldMember,
      newMember,
      oldRoles,
      newRoles,
      guildRoles,
      memberDbRoles,
    });

    updateNickname(oldMember, newMember);
  }
}
