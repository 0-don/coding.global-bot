import { error } from "console";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { prisma } from "../prisma";

@Discord()
export class PresenceUpdate {
  @On()
  async presenceUpdate([oldPresence, newPresence]: ArgsOf<"presenceUpdate">) {
    if (!newPresence.member || !newPresence.guild) return;

    try {
      // Update presence data in MemberGuild
      await prisma.memberGuild.updateMany({
        where: {
          memberId: newPresence.userId,
          guildId: newPresence.guild.id,
        },
        data: {
          presenceStatus: newPresence.status || null,
          presenceActivity: newPresence.activities[0]?.name || null,
          presenceUpdatedAt: new Date(),
        },
      });
    } catch (err) {
      error(
        `Failed to update presence for user ${newPresence.userId} in guild ${newPresence.guild.id}:`,
        err,
      );
    }
  }
}
