import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, Guild, PermissionsBitField } from "discord.js";
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
  .onError(({ code, error }) => console.error("API Error:", code, error))
  .derive(({ path }) => {
    const matches = path.match(/\/api\/(\d{17,19})/);
    const guildId = matches?.[1];
    return {
      guild: (guildId ? bot.guilds.cache.get(guildId) : null) as Guild | null,
    };
  })
  .derive(({ request, path }) => ({
    cacheKey: request.method === "GET" ? path : null,
  }))
  .onBeforeHandle(({ cacheKey }) => {
    if (!cacheKey) return;
    const cached = CACHE[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    if (cached) delete CACHE[cacheKey];
  })
  .onAfterHandle(({ cacheKey, responseValue }) => {
    if (cacheKey)
      CACHE[cacheKey] = { timestamp: Date.now(), data: responseValue };
  })
  .get(
    "/api/:guildId/staff",
    async ({ guild, params }) => {
      if (!guild) throw status("Not Found", "Guild not found");

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
      if (!guild) throw status("Not Found", "Guild not found");

      const newsChannel = guild.channels.cache.find((ch) =>
        ch.name.toLowerCase().includes("news"),
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

      const messages = Array.from(
        (await newsChannel.messages.fetch({ limit: PAGE_LIMIT })).values(),
      );
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
      if (!guild) throw status("Not Found", "Guild not found");

      const onlineMembers = await prisma.memberGuild.findMany({
        where: {
          guildId: params.guildId,
          status: true,
          presenceStatus: { in: ["online", "idle", "dnd"] },
        },
        orderBy: { highestRolePosition: "desc" },
        take: 100,
      });

      const members = await parseMultipleUsersWithRoles(
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

      return {
        id: guild.id,
        name: guild.name,
        members,
        presenceCount,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL({ extension: "webp", size: 256 }),
        bannerURL: guild.bannerURL({ extension: "webp", size: 1024 }),
      };
    },
    { params: t.Object({ guildId: t.String() }) },
  )

  .get(
    "/api/:guildId/board/:boardType",
    async ({ guild, params }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const boardChannel = guild.channels.cache.find((ch) =>
        ch.name.includes(params.boardType),
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

      return Promise.all(
        allThreads.map((thread) =>
          extractThreadDetails(thread, boardChannel, guild, params.boardType),
        ),
      );
    },
    { params: t.Object({ guildId: t.String(), boardType: BoardType }) },
  )

  .get(
    "/api/:guildId/board/:boardType/:threadId",
    async ({ guild, params, query }) => {
      if (!guild) throw status("Not Found", "Guild not found");

      const thread = guild.channels.cache.get(params.threadId);
      if (!thread?.isThread()) throw status("Not Found", "Thread not found");

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

      const messageList = messageArray
        .map((message) => ({
          ...parseMessage(message),
          author: authors.find((a) => a.id === message.author.id)!,
        }))
        .reverse();

      return {
        thread: threadDetails,
        messages: messageList,
        hasMore: messageArray.length === PAGE_LIMIT,
        nextCursor: messageList.length > 0 ? messageList[0].id : null,
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
