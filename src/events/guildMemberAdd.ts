import type { GuildMember } from "discord.js";
import { joinSettings } from "../modules/members/joinNickname.js";
import { joinRole } from "../modules/members/joinRole.js";
import { logJoinLeaveEvents } from "../modules/members/logJoinLeaveEvents.js";
import { updateMemberCount } from "../modules/members/updateMemberCount.js";
import { upsertDbMember } from "../modules/members/upsertDbMember.js";
import type { Event } from "../types/index.js";

export default {
  name: "guildMemberAdd",
  once: false,
  async execute(member: GuildMember) {
    await logJoinLeaveEvents(member, "join");

    // create or update user with his roles
    await upsertDbMember(member, "join");

    // rules not yet accepted
    if (member.pending) return;

    // if first time user give him status role
    // await joinRole(member, "unverified");

    // update user count channel
    await updateMemberCount(member);

    await joinSettings(member);
  },
} as Event<"guildMemberAdd">;
