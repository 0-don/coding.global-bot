import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, status, t } from "elysia";
import { Cache } from "./cache";
import { Prisma } from "./generated/prisma/client";
import { ThreadService } from "./lib/threads/thread.service";
import { bot } from "./main";
import { prisma } from "./prisma";
import {
  BoardType,
  CACHE_TTL,
  formatRepliesFromDb,
  formatThreadFromDb,
  formatThreadsFromDb,
  getTopStatsWithUsers,
  PAGE_LIMIT,
  parseMessage,
  parseMultipleUsersWithRoles,
  ThreadParams,
} from "./server/server";

export const cache = new Cache({
  ttl: CACHE_TTL,
  max: 1000,
});

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
  .onError(({ error }) => {
    // Log Prisma-specific errors only
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error:", error.code, error.message, error.meta);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("Prisma Validation Error:", error.message);
    }
  })
  .derive(({ path }) => {
    const matches = path.match(/\/api\/(\d{17,19})/);
    const guildId = matches?.[1];
    const guild = guildId ? bot.guilds.cache.get(guildId) : null;

    if (!guild) throw status("Not Found", "Guild not found");
    return { guild };
  })
  .derive(({ request, path }) => {
    if (request.method !== "GET") return { cacheKey: null };
    const url = new URL(request.url);
    const cacheKey = url.search ? `${path}${url.search}` : path;
    return { cacheKey };
  })
  .onBeforeHandle(({ cacheKey }) => {
    if (!cacheKey) return;
    return cache.get(cacheKey);
  })
  .onAfterHandle(({ cacheKey, responseValue }) => {
    if (cacheKey) cache.set(cacheKey, responseValue);
  })
  .get(
    "/api/:guildId/staff",
    async ({ guild, params }) => {
      const memberGuids = await prisma.memberGuild.findMany({
        where: { guildId: params.guildId, status: true },
        include: {
          member: {
            include: { roles: { where: { guildId: params.guildId } } },
          },
        },
      });

      const staffUserIds = memberGuids
        .filter((mg) =>
          mg.member.roles.some((role) => {
            const discordRole = guild.roles.cache.get(role.roleId);
            return (
              discordRole?.permissions.has(
                PermissionsBitField.Flags.MuteMembers,
              ) ||
              discordRole?.permissions.has(
                PermissionsBitField.Flags.ChangeNickname,
              )
            );
          }),
        )
        .map((mg) => mg.memberId);

      const users = await parseMultipleUsersWithRoles(staffUserIds, guild);
      return users.sort(
        (a, b) => b.highestRolePosition - a.highestRolePosition,
      );
    },
    { params: t.Object({ guildId: t.String() }) },
  )

  .get(
    "/api/:guildId/news",
    async ({ guild }) => {
      // Try cache first, only fetch from API if not found
      let newsChannel = guild.channels.cache.find((ch) =>
        ch?.name.toLowerCase().includes("news"),
      );

      if (!newsChannel) {
        const channels = await guild.channels.fetch();
        const found = channels.find((ch) =>
          ch?.name.toLowerCase().includes("news"),
        );
        if (found) newsChannel = found;
      }

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

      // Try cache first, only fetch if cache is empty
      let messages = Array.from(newsChannel.messages.cache.values())
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .slice(0, PAGE_LIMIT);

      if (messages.length === 0) {
        messages = Array.from(
          (await newsChannel.messages.fetch({ limit: PAGE_LIMIT })).values(),
        );
      }

      const authorIds = [...new Set(messages.map((msg) => msg.author.id))];
      const authors = await parseMultipleUsersWithRoles(authorIds, guild);

      return messages.map((message) => ({
        ...parseMessage(message),
        author: authors.find((a) => a.id === message.author.id)!,
      }));
    },
    { params: t.Object({ guildId: t.String() }) },
  )

  .get(
    "/api/:guildId/widget",
    async ({ guild, params }) => {
      const onlineMembers = await prisma.memberGuild.findMany({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: { in: ["online", "idle", "dnd"] },
        },
        orderBy: { highestRolePosition: "desc" },
        take: 100,
      });

      const users = await parseMultipleUsersWithRoles(
        onlineMembers.map((m) => m.memberId),
        guild,
      );
      const presenceCount = await prisma.memberGuild.count({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: { in: ["online", "idle", "dnd"] },
        },
      });

      const { members, ...widget } = {
        members: users,
        id: guild.id,
        name: guild.name,
        presenceCount,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: "webp", size: 256 }),
        bannerURL: guild.bannerURL({ extension: "webp", size: 1024 }),
      };

      return { ...widget, members };
    },
    { params: t.Object({ guildId: t.String() }) },
  )

  .get(
    "/api/:guildId/top-stats",
    async ({ params, query }) => {
      const limit = query.limit ? Math.min(Math.max(1, query.limit), 10) : 5;
      const days = query.days ?? 9999;
      return getTopStatsWithUsers(params.guildId, days, limit);
    },
    {
      params: t.Object({ guildId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.Number()),
        days: t.Optional(t.Number()),
      }),
    },
  )
  .get(
    "/api/:guildId/board/:boardType",
    async ({ params }) => {
      const boardType = params.boardType.toLowerCase();
      const threads = await ThreadService.getThreadsByBoard(
        params.guildId,
        boardType,
      );
      return formatThreadsFromDb(threads, params.guildId);
    },
    { params: t.Object({ guildId: t.String(), boardType: BoardType }) },
  )
  .get(
    "/api/:guildId/board/:boardType/:threadId",
    async ({ params }) => {
      const thread = await ThreadService.getThread(params.threadId);
      if (!thread) {
        throw status("Not Found", "Thread not found");
      }
      return formatThreadFromDb(thread, params.guildId);
    },
    { params: ThreadParams },
  )
  .get(
    "/api/:guildId/board/:boardType/:threadId/messages",
    async ({ params, query }) => {
      const { messages, hasMore, nextCursor } = await ThreadService.getReplies(
        params.threadId,
        { after: query.after, limit: PAGE_LIMIT },
      );
      return {
        messages: formatRepliesFromDb(messages, params.guildId),
        hasMore,
        nextCursor,
      };
    },
    {
      params: ThreadParams,
      query: t.Object({ after: t.Optional(t.String()) }),
    },
  )
  .listen(4000);

log("Server started on port 4000");
