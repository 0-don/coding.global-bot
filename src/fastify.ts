import cors from "@fastify/cors";
import { PermissionsBitField } from "discord.js";
import Fastify from "fastify";
import { bot } from "./main.js";

const fastify = Fastify({
  // logger: true,
});

await fastify.register(cors, {
  origin: false,
  credentials: true,
});

fastify.get("/api/:guildId/staff", async (req, reply) => {
  const { guildId } = req.params as { guildId: string };

  const guild = bot.guilds.cache.get(guildId);
  if (!guild) {
    return reply.code(404).send({ error: "Guild not found" });
  }

  const members = (await guild.members.fetch()).filter((member) =>
    member.permissions.has(PermissionsBitField.Flags.MuteMembers)
  );

  const staff: {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string;
    staffRoles: string[];
  }[] = [];

  for (const member of members.values()) {
    const staffRoles = member.roles.cache
      .filter((role) =>
        role.permissions.has(PermissionsBitField.Flags.MuteMembers)
      )
      .map((role) => role.name);

    if (staffRoles.length) {
      staff.push({
        id: member.id,
        username: member.user.username,
        globalName: member.user.globalName,
        avatarUrl: member.user.displayAvatarURL(),
        staffRoles,
      });
    }
  }

  reply.send(staff);
});

fastify
  .listen(3000, process.env.NODE_ENV === "production" ? "0.0.0.0" : undefined)
  .then((address) => {
    console.log(`Server listening on ${address}`);
  });
