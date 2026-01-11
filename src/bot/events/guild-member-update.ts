import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { handleGuildMemberUpdate } from "@/core/handlers/event-handlers/guild-member-update.handler";

@Discord()
export class GuildMemberUpdate {
  @On()
  async guildMemberUpdate([oldMember, newMember]: ArgsOf<"guildMemberUpdate">) {
    await handleGuildMemberUpdate(oldMember, newMember);
  }
}
