import { updateNickname } from "../modules/members/saveNickname.js";
import { updateDbRoles } from "../modules/roles/updateDbRoles.js";
import { updateStatusRoles } from "../modules/roles/updateStatusRoles.js";
import type { Event } from "../types/index.js";

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
