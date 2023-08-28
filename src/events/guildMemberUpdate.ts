import type { Event } from "../types/index.js";
import { updateNickname } from "../utils/members/saveNickname.js";
import { updateDbRoles } from "../utils/roles/updateDbRoles.js";
import { updateStatusRoles } from "../utils/roles/updateStatusRoles.js";

export default {
  name: "guildMemberUpdate",
  once: false,
  async execute(oldMember, newMember) {
    // if rules acepted add join role
    // if (oldMember.pending && !newMember.pending)
    //   await joinRole(newMember, 'verified');

    // update db roles
    await updateDbRoles(oldMember, newMember);

    // update status roles
    await updateStatusRoles(oldMember, newMember);

    await updateNickname(oldMember, newMember);
  },
} as Event<"guildMemberUpdate">;
