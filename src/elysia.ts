import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, status, t } from "elysia";
import { bot } from "./main";
import { parseUserWithRoles } from "./server/server";

const cache: Record<string, { timestamp: number; data: unknown }> = {};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const app = new Elysia({ adapter: node() })
  .use(
    openapi({
      references: fromTypes(
        process.env.NODE_ENV === "production"
          ? "dist/elysia.d.ts"
          : "src/elysia.ts",
      ),
    }),
  )
  .use(cors())
  .onError(({ code, error }) => {
    console.error("API Error:", code, error);
  })
  .derive(({ request }) => ({
    startTime: Date.now(),
    clientIP:
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("x-forwarded-for") ||
      "Unknown IP",
  }))
  .derive(({ path }) => {
    const matches = path.match(/\/api\/(\d{17,19})/);
    const guildId = matches ? matches[1] : null;

    if (!guildId) return { guild: null };

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return { guild: null };

    return { guild };
  })
  .derive(({ request, path }) => {
    if (request.method !== "GET") return { cacheKey: null };
    return { cacheKey: path };
  })
  .onBeforeHandle(({ cacheKey }) => {
    if (!cacheKey) return;

    const cachedData = cache[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.data;
    }

    if (cachedData) delete cache[cacheKey];
  })
  .onAfterHandle(({ cacheKey, response }) => {
    if (!cacheKey) return;

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: response,
    };
  })
  .get(
    "/api/:guildId/staff",
    async ({ guild }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const staffMembers = (await guild.members.fetch()).filter(
        (member) =>
          (member.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
            member.permissions.has(PermissionsBitField.Flags.ChangeNickname)) &&
          !member.user.bot,
      );

      const users = [];
      for (const [_, member] of staffMembers) {
        const userData = await parseUserWithRoles(member.id, guild, member);
        if (userData) users.push(userData);
      }

      users.sort((a, b) => b.highestRolePosition - a.highestRolePosition);

      return users;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .get(
    "/api/:guildId/news",
    async ({ guild }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const newsChannel = guild.channels.cache.find((channel) =>
        channel.name.toLowerCase().includes("news"),
      );

      if (!newsChannel) throw status("Not Found", "News channel not found");

      if (
        newsChannel.type !== ChannelType.GuildText &&
        newsChannel.type !== ChannelType.GuildAnnouncement
      ) {
        throw status(
          "Bad Request",
          "News channel must be a text or announcement channel",
        );
      }

      const messages = await newsChannel.messages.fetch({ limit: 100 });

      const news = await Promise.all(
        messages.map(async (message) => ({
          id: message?.id,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          attachments: Array.from(message.attachments.values())
            .filter((attachment) =>
              attachment.contentType?.startsWith("image/"),
            )
            .map((attachment) => ({
              url: attachment.url,
              width: attachment.width!,
              height: attachment.height!,
              contentType: attachment.contentType!,
            })),
          user: await parseUserWithRoles(message.author.id, guild, message),
        })),
      );

      return news;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .get(
    "/api/:guildId/widget",
    async ({ guild }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      try {
        await guild.members.fetch();
      } catch (error) {}

      // Count online members only
      const onlineMembers = guild.members.cache.filter(
        (member) =>
          (member.presence?.status === "online" ||
            member.presence?.status === "idle" ||
            member.presence?.status === "dnd") &&
          !member.user.bot,
      );

      // Sort members by highest role position BEFORE fetching details
      const sortedOnlineMembers = Array.from(onlineMembers.values()).sort(
        (a, b) => {
          const highestRoleA = a.roles.highest.position;
          const highestRoleB = b.roles.highest.position;
          return highestRoleB - highestRoleA;
        },
      );

      // Only fetch details for top 100 members
      const top100Members = sortedOnlineMembers.slice(0, 100);

      const members = [];
      for (let i = 0; i < top100Members.length; i++) {
        const member = top100Members[i];
        console.log(
          `Processing member ${i + 1}/${top100Members.length}: ${member.user.tag}`,
        );
        const userData = await parseUserWithRoles(member.id, guild, member);
        if (userData) members.push(userData);
      }

      const widget = {
        id: guild.id,
        name: guild.name,
        members,
        presenceCount: onlineMembers.size,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: "webp", size: 256 }),
        bannerURL: guild.bannerURL({ extension: "webp", size: 1024 }),
      };

      return widget;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .listen(4000);

log("Server started on port 4000");
