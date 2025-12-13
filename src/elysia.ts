import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { ChannelType, PermissionsBitField } from "discord.js";
import { Elysia, status, t } from "elysia";
import { STATUS_ROLES } from "./lib/constants";
import { bot } from "./main";
import { prisma } from "./prisma";

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

      const staffMembers = (await guild.members.fetch())
        .filter(
          (member) =>
            (member.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
              member.permissions.has(
                PermissionsBitField.Flags.ChangeNickname,
              )) &&
            !member.user.bot,
        )
        .sort((a, b) => a.joinedAt!.getTime() - b.joinedAt!.getTime());

      const memberRoles = await prisma.memberRole.findMany({
        where: { memberId: { in: Array.from(staffMembers.keys()) } },
        select: { memberId: true, name: true },
      });

      const users = [];
      for (const [_, member] of staffMembers) {
        const roles = memberRoles.filter(
          (role) => role.memberId === member?.id,
        );
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
            displayHexColor: (member.displayHexColor || "#000000") as string,
            memberRoles: roles.map((role) => role.name || ""),
          });
        }
      }

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

      const news = messages.map((message) => ({
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
          displayHexColor: (message.member?.displayHexColor ||
            "#000000") as string,
        },
      }));

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
          member.presence?.status === "online" ||
          member.presence?.status === "idle" ||
          member.presence?.status === "dnd",
      );

      // Find the highest position among STATUS_ROLES (verified, voiceonly, jail)
      const statusRolePositions = Array.from(guild.roles.cache.values())
        .filter((role) => {
          const lowerName = role.name.toLowerCase();
          return STATUS_ROLES.some((sr) => sr.toLowerCase() === lowerName);
        })
        .map((role) => role.position);

      const highestStatusRolePosition =
        statusRolePositions.length > 0 ? Math.max(...statusRolePositions) : 0;

      // Fetch member roles from database for all online members
      const memberRoles = await prisma.memberRole.findMany({
        where: {
          memberId: { in: Array.from(onlineMembers.keys()) },
        },
        select: { memberId: true, name: true, roleId: true },
      });

      // Filter to non-bot members and enrich with role information
      const membersWithRoles = onlineMembers
        .filter((member) => !member.user.bot)
        .map((member) => {
          const dbRoles = memberRoles.filter(
            (role) => role.memberId === member.id,
          );

          // Get Discord role objects with positions for this member
          const discordRoles = dbRoles
            .map((dbRole) => {
              const discordRole = guild.roles.cache.get(dbRole.roleId);
              return discordRole
                ? {
                    id: dbRole.roleId,
                    name: dbRole.name || discordRole.name,
                    position: discordRole.position,
                  }
                : null;
            })
            .filter(
              (role): role is { id: string; name: string; position: number } =>
                role !== null,
            );

          // Find the highest role position this member has
          const highestRolePosition =
            discordRoles.length > 0
              ? Math.max(...discordRoles.map((r) => r.position))
              : 0;

          // Get status roles (only roles positioned HIGHER than STATUS_ROLES)
          const statusRoles = discordRoles
            .filter((role) => role.position > highestStatusRolePosition)
            .map((role) => ({
              name: role.name,
              position: role.position,
            }));

          return {
            id: member.id,
            username: member.user.username,
            discriminator: member.user.discriminator,
            avatar: member.user.displayAvatarURL({
              extension: "webp",
              size: 128,
            }),
            status: String(member.presence?.status || "offline"),
            activity: member.presence?.activities[0]?.name || null,
            statusRoles,
            highestRolePosition,
          };
        });

      // Sort by highest role position (higher position = more important)
      const sortedMembers = membersWithRoles.sort((a, b) => {
        return b.highestRolePosition - a.highestRolePosition;
      });

      // Take first 50 members
      const members = sortedMembers.slice(0, 50);

      const widget = {
        id: guild.id,
        name: guild.name,
        members,
        presenceCount: onlineMembers.size,
        memberCount: guild.memberCount,
        icon: guild.iconURL({ extension: "webp", size: 256 }),
        banner: guild.bannerURL({ extension: "webp", size: 1024 }),
      };

      return widget;
    },
    { params: t.Object({ guildId: t.String() }) },
  )
  .listen(4000);

log("Server started on port 4000");
