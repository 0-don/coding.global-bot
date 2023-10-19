import { switchRoleFromTemplate } from "../modules/roles/roleTemplateReaction.js";
import type { Event } from "../types/index.js";

export default {
  name: "messageReactionRemove",
  once: false,
  async execute(reaction, user) {
    // remove role if exist when clicked on role template embed
    await switchRoleFromTemplate(reaction, user, "remove");
  },
} as Event<"messageReactionRemove">;
