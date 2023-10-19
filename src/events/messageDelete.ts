import { deleteMessageDb } from "../modules/messages/deleteMessageDb.js";
import type { Event } from "../types/index.js";

export default {
  name: "messageDelete",
  once: false,
  async execute(message) {
    // add Message to Database for statistics
    await deleteMessageDb(message);
  },
} as Event<"messageDelete">;
