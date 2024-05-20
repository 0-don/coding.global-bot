import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { writeFileSync } from "fs";
import { EVERYONE } from "../lib/constants.js";
import { updateNickname } from "../lib/members/saveNickname.js";
import { RolesService } from "../lib/roles/Roles.service.js";
import { prisma } from "../prisma.js";

@Discord()
export class GuildMemberUpdate {
  @On()
  async guildMemberUpdate(
    [oldMember, newMember]: ArgsOf<"guildMemberUpdate">,
    client: Client
  ) {
    console.time("guildMemberUpdate");
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

    if (process.env.NODE_ENV !== "production")
      writeFileSync(
        `test/${Date.now()}.json`,
        JSON.stringify(
          {
            oldRoles,
            newRoles,
            memberDbRoles,
            oldMember,
            newMember,
            guildRoles,
          },
          null,
          2
        )
      );

    // update db roles
    RolesService.updateDbRoles({
      oldMember,
      newMember,
      oldRoles,
      newRoles,
      guildRoles,
      memberDbRoles,
    });

    // // update status roles
    RolesService.updateStatusRoles({
      oldMember,
      newMember,
      oldRoles,
      newRoles,
      guildRoles,
      memberDbRoles,
    });

    updateNickname(oldMember, newMember);
    
    console.timeEnd("guildMemberUpdate");
  }
}
