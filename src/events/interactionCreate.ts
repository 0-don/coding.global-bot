import { isCommand } from "../modules/interractionCreate/isCommand.js";
import type { Event } from "../types/index.js";

export default {
  name: "interactionCreate",
  async execute(interaction) {
    // check if the interaction is a command
    await isCommand(interaction);
  },
} as Event<"interactionCreate">;
