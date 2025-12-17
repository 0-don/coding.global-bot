import { error } from "console";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class PresenceUpdate {
  @On()
  async presenceUpdate([oldPresence, newPresence]: ArgsOf<"presenceUpdate">) {
    if (!newPresence.member || !newPresence.guild) return;

    try {
      // await updateCompleteMemberData(newPresence.member);
    } catch (err) {
      error(
        `Failed to update presence for user ${newPresence.userId} in guild ${newPresence.guild.id}:`,
        err,
      );
    }
  }
}
