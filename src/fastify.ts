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

fastify.get("/api/:guildId/staff", async (req, reply) => {
  const { guildId } = req.params as { guildId: string };

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
    avatarUrl: string;
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

    if (memberRoles.length) {
      staff.push({
        id: member.id,
        username: member.user.username,
        globalName: member.user.globalName,
        joinedAt: member.joinedAt!.toISOString(),
        avatarUrl: member.user.displayAvatarURL({ size: 512 }),
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
  .then((address) => {
    console.log(`Server listening on ${address}`);
  });
