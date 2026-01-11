import { bot } from "@/main";
import { Elysia, status } from "elysia";

export const guildDerive = new Elysia({ name: "guild-derive" }).derive(
  ({ path }) => {
    const matches = path.match(/\/api\/(\d{17,19})/);
    const guildId = matches?.[1];
    const guild = guildId ? bot.guilds.cache.get(guildId) : null;

    if (!guild) throw status("Not Found", "Guild not found");
    return { guild };
  },
);
