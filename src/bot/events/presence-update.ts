import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";

@Discord()
export class PresenceUpdate {
  @On()
  async presenceUpdate([oldPresence, newPresence]: ArgsOf<"presenceUpdate">) {
    if (!newPresence.member || !newPresence.guild) return;

    MemberUpdateQueueService.queueMemberUpdate(
      newPresence.member.id,
      newPresence.guild.id,
      -1,
    );
  }
}
