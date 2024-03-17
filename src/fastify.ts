import cors from "@fastify/cors";
import { PermissionsBitField } from "discord.js";
import Fastify from "fastify";
import { bot } from "./main.js";

const fastify = Fastify({
  // logger: true,
});

await fastify.register(cors, {
  origin: ["*"],
  credentials: true,
});

const cache: Record<string, any> = {};

fastify.get("/api/:guildId/staff", async (req, reply) => {
  const { guildId } = req.params as { guildId: string };

  const cacheKey = `staff-${guildId}`;
  const currentTime = Date.now();

  if (cache[cacheKey] && currentTime - cache[cacheKey].timestamp < 3600000) {
    return reply.send(cache[cacheKey].data);
  }
  
  const guild = bot.guilds.cache.get(guildId);
  if (!guild) {
    return reply.code(404).send({ error: "Guild not found" });
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

  for (const member of members.values()) {
    if (member.user.bot) continue;
    const memberRoles = member.roles.cache
      .filter(
        (role) =>
          role.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
          role.permissions.has(PermissionsBitField.Flags.ManageMessages)
      )
      .map((role) => role.name);

    await member.user.fetch();
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

  reply.send(staff);
});

fastify
  .listen({
    port: 3000,
    host: process.env.NODE_ENV === "production" ? "0.0.0.0" : undefined,
  })
  .then((address) => console.log(`Server listening on ${address}`));
