import { serve } from "@hono/node-server";
import { log } from "console";
import dayjs from "dayjs";
import { PermissionsBitField } from "discord.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { bot } from "./main.js";

const cache: Record<string, any> = {};

const app = new Hono()
  .use("*", cors())
  .get("/api/:guildId/staff", async (c) => {
    const { guildId } = c.req.param();
    const cacheKey = `staff-${guildId}`;

    if (
      cache[cacheKey] &&
      dayjs().diff(dayjs(cache[cacheKey].timestamp), "hour") < 1
    ) {
      return c.json(cache[cacheKey].data);
    }

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      throw new HTTPException(401, { message: "Guild not found" });
    }

    const members = (await guild.members.fetch())
      .filter((member) =>
        member.permissions.has(PermissionsBitField.Flags.MuteMembers)
      )
      .sort((a, b) => a.joinedAt!.getTime() - b.joinedAt!.getTime());

    const staff: {
      id: string;
      username: string;
      globalName: string | null;
      joinedAt: string;
      displayAvatarURL: string;
      bannerUrl?: string | null;
      displayHexColor: string;
      memberRoles: string[];
    }[] = [];

    await Promise.all(members.map((member) => member.user.fetch()));

    for (const member of members.values()) {
      if (member.user.bot) continue;
      const memberRoles = member.roles.cache
        .filter(
          (role) =>
            role.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
            role.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
            role.name === "Booster"
        )
        .map((role) => role.name);

      if (memberRoles.length) {
        staff.push({
          id: member.id,
          username: member.user.username,
          globalName: member.user.globalName,
          joinedAt: member.joinedAt!.toISOString(),
          displayAvatarURL: member.user.displayAvatarURL({
            size: 512,
            extension: "webp",
          }),
          bannerUrl: member.user.bannerURL({ size: 512, extension: "webp" }),
          displayHexColor: member.displayHexColor,
          memberRoles,
        });
      }
    }

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: staff,
    };

    return c.json(staff);
  });

serve({ fetch: app.fetch, port: 3000 });

log("Server started on port 3000");
