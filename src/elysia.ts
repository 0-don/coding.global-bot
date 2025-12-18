import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, status, t } from "elysia";
import { bot } from "./main";
import { prisma } from "./prisma";
import {
  parseMultipleUsersWithRoles,
  parseUserWithRoles,
} from "./server/server";

const cache: Record<string, { timestamp: number; data: unknown }> = {};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const PAGE_LIMIT = 100;

const BoardType = t.Union([
  t.Literal("job-board"),
  t.Literal("dev-board"),
  t.Literal("showcase"),
]);

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
          user: await parseUserWithRoles(message.author.id, guild),
        })),
      );

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

      const ownerIds = allThreads.map((thread) => thread.ownerId);
      const owners = await parseMultipleUsersWithRoles(ownerIds, guild);

      const threadList = await Promise.all(
        allThreads.map(async (thread) => {
          const author = owners.find((owner) => owner.id === thread.ownerId);

          const tags = thread.appliedTags
            .map((tagId) => {
              const tag = boardChannel.availableTags.find(
                (t) => t.id === tagId,
              );
              return {
                id: tag!.id,
                name: tag!.name,
                emoji: {
                  id: tag!.emoji?.id || null,
                  name: tag!.emoji?.name || null,
                },
              };
            })
            .filter(Boolean);

          let previewImage: string | null = null;
          let previewText: string | null = null;
          try {
            const starterMessage = await thread.fetchStarterMessage();
            if (starterMessage) {
              const imageAttachment = starterMessage.attachments.find(
                (attachment) => attachment.contentType?.startsWith("image/"),
              );
              previewImage = imageAttachment?.url || null;
              previewText = starterMessage.content || null;
            }
          } catch (error) {}

          const result = {
            id: thread.id,
            name: thread.name,
            boardType: params.boardType,
            messageCount: thread.messageCount,
            author: author || null,
            archived: !!thread.archived,
            locked: thread.locked,
            createdAt: thread.createdAt?.toISOString(),
            tags,
            previewImage,
            previewText,
          };
          return result;
        }),
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

      const messages = await thread.messages.fetch({
        limit: PAGE_LIMIT,
        before: query.before,
      });
      const messageArray = Array.from(messages.values());

      const authorIds = [...new Set(messageArray.map((msg) => msg.author.id))];
      const authors = await parseMultipleUsersWithRoles(authorIds, guild);

      const messageList = messageArray.map((message) => {
        const author = authors.find((a) => a.id === message.author.id);

        return {
          id: message.id,
          content: message.content,
          author: author || null,
          createdAt: message.createdAt.toISOString(),
          attachments: Array.from(message.attachments.values()).map(
            (attachment) => ({
              url: attachment.url,
              name: attachment.name,
              contentType: attachment.contentType,
              size: attachment.size,
            }),
          ),
          embeds: message.embeds.map((embed) => ({
            title: embed.title,
            description: embed.description,
            url: embed.url,
            color: embed.color,
          })),
        };
      });

      const sortedMessages = messageList.reverse();

      return {
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
