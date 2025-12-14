import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { EVERYONE } from "../lib/constants";
import { updateNickname } from "../lib/members/save-nickname";
import { RolesService } from "../lib/roles/roles.service";
import { prisma } from "../prisma";

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

    const sortedRoles = Array.from(newMember.roles.cache.values())
      .filter((role) => role.name !== EVERYONE)
      .sort((a, b) => b.position - a.position);

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          memberId: newMember.id,
          guildId: newMember.guild.id,
        },
      },
      data: {
        nickname: newMember.nickname,
        displayName: newMember.displayName,
        displayHexColor: newMember.displayHexColor,
        highestRolePosition: sortedRoles[0]?.position || null,
        avatarUrl: newMember.avatarURL({ size: 1024 }) || null,
        presenceStatus: newMember.presence?.status || null,
        presenceActivity: newMember.presence?.activities[0]?.name || null,
        presenceUpdatedAt: newMember.presence ? new Date() : null,
      },
    });
  }
}
