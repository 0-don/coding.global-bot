import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, status, t } from "elysia";
import { bot } from "./main";
import { prisma } from "./prisma";
import {
  BoardType,
  CACHE_TTL,
  extractThreadDetails,
  PAGE_LIMIT,
  parseMessage,
  parseMultipleUsersWithRoles,
} from "./server/server";

const CACHE: Record<string, { timestamp: number; data: unknown }> = {};

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

    const cachedData = CACHE[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.data;
    }

    if (cachedData) delete CACHE[cacheKey];
  })
  .onAfterHandle(({ cacheKey, responseValue }) => {
    if (!cacheKey) return;

    CACHE[cacheKey] = {
      timestamp: Date.now(),
      data: responseValue,
    };
  })
  .get(
    "/api/:guildId/staff",
    async ({ guild, params }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const memberGuids = await prisma.memberGuild.findMany({
        where: {
          guildId: params.guildId,
          status: true,
        },
        include: {
          member: {
            include: {
              roles: {
                where: { guildId: params.guildId },
              },
            },
          },
        },
      });

      const staffUserIds = memberGuids
        .filter((memberGuild) => {
          // Check if any of their roles have staff permissions
          return memberGuild.member.roles.some((role) => {
            const discordRole = guild.roles.cache.get(role.roleId);
            if (!discordRole) return false;
            return (
              discordRole.permissions.has(
                PermissionsBitField.Flags.MuteMembers,
              ) ||
              discordRole.permissions.has(
                PermissionsBitField.Flags.ChangeNickname,
              )
            );
          });
        })
        .map((memberGuild) => memberGuild.memberId);

      const users = await parseMultipleUsersWithRoles(staffUserIds, guild);
      users.sort((a, b) => b.highestRolePosition - a.highestRolePosition);

      return users;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .get(
    "/api/:guildId/news",
    async ({ guild }) => {
      if (!guild) throw status("Not Found", "News channel not found");

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

      const messages = await newsChannel.messages.fetch({ limit: PAGE_LIMIT });
      const messageArray = Array.from(messages.values());

      const authorIds = [...new Set(messageArray.map((msg) => msg.author.id))];
      const authors = await parseMultipleUsersWithRoles(authorIds, guild);

      const news = messageArray.map((message) => ({
        ...parseMessage(message, true),
        author: authors.find((a) => a.id === message.author.id)!,
      }));

      return news;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .get(
    "/api/:guildId/widget",
    async ({ guild, params }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const onlineMembers = await prisma.memberGuild.findMany({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: {
            in: ["online", "idle", "dnd"],
          },
        },
        orderBy: {
          highestRolePosition: "desc",
        },
        take: 100,
      });

      const userIds = onlineMembers.map((member) => member.memberId);
      const members = await parseMultipleUsersWithRoles(userIds, guild);

      const presenceCount = await prisma.memberGuild.count({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: {
            in: ["online", "idle", "dnd"],
          },
        },
      });

      const widget = {
        id: guild.id,
        name: guild.name,
        members,
        presenceCount,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: "webp", size: 256 }),
        bannerURL: guild.bannerURL({ extension: "webp", size: 1024 }),
      };

      return widget;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .get(
    "/api/:guildId/board/:boardType",
    async ({ guild, params }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const boardChannel = guild.channels.cache.find((channel) =>
        channel.name.includes(params.boardType),
      );

      if (!boardChannel)
        throw status("Not Found", `${params.boardType} channel not found`);

      if (boardChannel.type !== ChannelType.GuildForum) {
        throw status(
          "Bad Request",
          `${params.boardType} must be a forum channel`,
        );
      }

      const threads = await boardChannel.threads.fetchActive();
      const archivedThreads = await boardChannel.threads.fetchArchived();

      const allThreads = [
        ...threads.threads.values(),
        ...archivedThreads.threads.values(),
      ];

      const threadList = await Promise.all(
        allThreads.map((thread) =>
          extractThreadDetails(thread, boardChannel, guild, params.boardType),
        ),
      );

      return threadList;
    },
    {
      params: t.Object({
        guildId: t.String(),
        boardType: BoardType,
      }),
    },
  )
  .get(
    "/api/:guildId/board/:boardType/:threadId",
    async ({ guild, params, query }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const thread = guild.channels.cache.get(params.threadId);

      if (!thread || !thread.isThread()) {
        throw status("Not Found", "Thread not found");
      }

      const boardChannel = thread.parent;
      if (!boardChannel || boardChannel.type !== ChannelType.GuildForum) {
        throw status("Bad Request", "Thread parent must be a forum channel");
      }

      const threadDetails = await extractThreadDetails(
        thread,
        boardChannel,
        guild,
        params.boardType,
      );

      const messages = await thread.messages.fetch({
        limit: PAGE_LIMIT,
        before: query.before,
      });
      const messageArray = Array.from(messages.values());

      const authorIds = [...new Set(messageArray.map((msg) => msg.author.id))];
      const authors = await parseMultipleUsersWithRoles(authorIds, guild);

      const messageList = messageArray.map((message) => ({
        ...parseMessage(message),
        author: authors.find((a) => a.id === message.author.id)!,
      }));

      const sortedMessages = messageList.reverse();

      return {
        thread: threadDetails,
        messages: sortedMessages,
        hasMore: messageArray.length === PAGE_LIMIT,
        nextCursor: sortedMessages.length > 0 ? sortedMessages[0].id : null,
      };
    },
    {
      params: t.Object({
        guildId: t.String(),
        boardType: BoardType,
        threadId: t.String(),
      }),
      query: t.Object({ before: t.Optional(t.String()) }),
    },
  )
  .listen(4000);

log("Server started on port 4000");
