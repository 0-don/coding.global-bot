import type { GuildMember } from "discord.js";
import type { Event } from "../types/index.js";
import { joinSettings } from "../utils/members/joinNickname.js";
import { joinRole } from "../utils/members/joinRole.js";
import { logJoinLeaveEvents } from "../utils/members/logJoinLeaveEvents.js";
import { updateMemberCount } from "../utils/members/updateMemberCount.js";
import { upsertDbMember } from "../utils/members/upsertDbMember.js";

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
    await joinRole(member, "unverified");

    // update user count channel
    await updateMemberCount(member);

    await joinSettings(member);
  },
} as Event<"guildMemberAdd">;
