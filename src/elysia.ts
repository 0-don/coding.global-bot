import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { swagger } from "@elysiajs/swagger";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, ElysiaAdapter, status, t } from "elysia";
import { verifyAllUsers } from "./lib/members/verify-all-users";
import { bot } from "./main";
import { prisma } from "./prisma";

const UserSchema = t.Object({
  id: t.String(),
  username: t.String(),
  globalName: t.String({ nullable: true }),
  joinedAt: t.String(),
  displayAvatarURL: t.String(),
  bannerUrl: t.String({ nullable: true }),
  displayHexColor: t.Optional(t.String()),
  memberRoles: t.Array(t.String()),
});

const NewsAttachmentSchema = t.Object({
  url: t.String(),
  width: t.Number({ nullable: true }),
  height: t.Number({ nullable: true }),
  contentType: t.String({ nullable: true }),
});

const NewsSchema = t.Object({
  id: t.String(),
  content: t.String(),
  createdAt: t.String(),
  attachments: t.Array(NewsAttachmentSchema),
  user: UserSchema,
});

const cache: Record<string, { timestamp: number; data: unknown }> = {};
const locks: Record<string, boolean> = {};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

new Elysia({ adapter: node() as ElysiaAdapter })
  .use(swagger())
  .use(cors())
  .derive(({ request }) => ({
    startTime: Date.now(),
    clientIP:
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("x-forwarded-for") ||
      "Unknown IP",
  }))
  // .onAfterHandle(({ startTime, clientIP, request }) =>
  //   log(
  //     `[${new Date().toLocaleString("de")}] ${request.method} ${request.url} - Client IP: ${clientIP} - Duration: ${Date.now() - startTime}ms`
  //   )
  // )
  .derive(({ path }) => {
    const matches = path.match(/\/api\/(\d{17,19})/);
    const guildId = matches ? matches[1] : null;

    if (!guildId) return { guild: null };

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return { guild: null };

    return { guild };
  })
  .get("/api/:guildId/verify-all-users", ({ guild }) => {
    if (!guild) throw status(404, "Guild not found");
    if (locks[guild.id])
      throw status(409, "Verification is already in progress");

    try {
      locks[guild.id] = true;
      verifyAllUsers(guild).finally(() => (locks[guild.id] = false));
      return "Verification started";
    } catch (err) {
      console.error(err);
      throw status(500, "An error occurred while verifying users");
    }
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
  .get("/api/:guildId/staff", async ({ guild }) => {
    if (!guild) throw status(404, "Guild not found");

    const staffMembers = (await guild.members.fetch())
      .filter(
        (member) =>
          (member.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
            member.permissions.has(PermissionsBitField.Flags.ChangeNickname)) &&
          !member.user.bot
      )
      .sort((a, b) => a.joinedAt!.getTime() - b.joinedAt!.getTime());

    const memberRoles = await prisma.memberRole.findMany({
      where: { memberId: { in: Array.from(staffMembers.keys()) } },
      select: { memberId: true, name: true },
    });

    const users: (typeof UserSchema.static)[] = [];
    for (const [_, member] of staffMembers) {
      const roles = memberRoles.filter((role) => role.memberId === member?.id);
      if (roles.length) {
        users.push({
          id: member?.id,
          username: member.user.username,
          globalName: member.user.globalName!,
          joinedAt: member.joinedAt!.toISOString(),
          displayAvatarURL: member.user.displayAvatarURL({
            size: 512,
            extension: "webp",
          }),
          bannerUrl: member.user.bannerURL({ size: 512, extension: "webp" })!,
          displayHexColor: member.displayHexColor || null,
          memberRoles: roles.map((role) => role.name || ""),
        });
      }
    }

    return users;
  })
  .get("/api/:guildId/news", async ({ guild }) => {
    if (!guild) throw status(404, "Guild not found");

    const newsChannel = guild.channels.cache.find((channel) =>
      channel.name.toLowerCase().includes("news")
    );

    if (!newsChannel) throw status(404, "News channel not found");

    if (
      newsChannel.type !== ChannelType.GuildText &&
      newsChannel.type !== ChannelType.GuildAnnouncement
    ) {
      throw status(400, "News channel must be a text or announcement channel");
    }

    const messages = await newsChannel.messages.fetch({ limit: 100 });

    const memberRoles = await prisma.memberRole.findMany({
      where: {
        memberId: {
          in: messages
            .map((m) => m.author?.id)
            .filter((id): id is string => !!id),
        },
      },
      select: { memberId: true, name: true },
    });

    const news: (typeof NewsSchema.static)[] = messages.map((message) => ({
      id: message?.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      attachments: Array.from(message.attachments.values())
        .filter((attachment) => attachment.contentType?.startsWith("image/"))
        .map((attachment) => ({
          url: attachment.url,
          width: attachment.width!,
          height: attachment.height!,
          contentType: attachment.contentType!,
        })),
      user: {
        id: message.author?.id,
        username: message.author.username,
        globalName: message.author.globalName!,
        joinedAt: message.author.createdAt.toISOString(),
        displayAvatarURL: message.author.displayAvatarURL({
          size: 512,
          extension: "webp",
        }),
        bannerUrl: message.author.bannerURL({
          size: 512,
          extension: "webp",
        })!,
        memberRoles: memberRoles
          .filter((role) => role.memberId === message.author?.id)
          .map((role) => role.name || ""),
        displayHexColor: message.member?.displayHexColor!,
      },
    }));

    return news;
  })
  .listen(3000);

log("Server started on port 3000");
