import { AnyThreadChannel, ForumChannel, Guild, Message } from "discord.js";
import { Static, t } from "elysia";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../prisma";

export const PAGE_LIMIT = 100;
export const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const BoardType = t.Union([
  t.Literal("job-board"),
  t.Literal("dev-board"),
  t.Literal("showcase"),
]);

type MemberGuildWithRelations = Prisma.MemberGuildGetPayload<{
  include: {
    member: {
      include: {
        roles: true;
      };
    };
  };
}>;

function formatMemberGuild(
  memberGuild: MemberGuildWithRelations,
  resolvedGuildId: string,
) {
  const roles = memberGuild.member.roles
    .filter((role) => role.roleId !== resolvedGuildId)
    .map((role) => ({
      name: role.name || "",
      position: role.position || 0,
    }));

  return {
    // Identity
    id: memberGuild.memberId,
    username: memberGuild.member.username,
    globalName: memberGuild.member.globalName,
    nickname: memberGuild.nickname,
    displayName: memberGuild.displayName,

    // Appearance
    avatarUrl:
      memberGuild.avatarUrl ||
      memberGuild.member.avatarUrl ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(memberGuild.memberId) % 5}.png`,
    bannerUrl: memberGuild.bannerUrl || memberGuild.member.bannerUrl || null,
    accentColor: memberGuild.member.accentColor,
    displayHexColor: memberGuild.displayHexColor || "#000000",
    flags: memberGuild.member.flags?.toString() || null,
    collectibles: JSON.stringify(memberGuild.member.collectibles) || null,
    primaryGuild: JSON.stringify(memberGuild.member.primaryGuild) || null,

    // Roles
    roles,
    highestRolePosition: memberGuild.highestRolePosition || 0,

    // Presence
    status: memberGuild.presenceStatus || "offline",
    activity: memberGuild.presenceActivity || null,
    presenceUpdatedAt: memberGuild.presenceUpdatedAt?.toISOString() || null,

    // Timestamps
    premiumSince: memberGuild.premiumSince?.toISOString() || null,
    communicationDisabledUntil:
      memberGuild.communicationDisabledUntil?.toISOString() || null,
    joinedAt: memberGuild.joinedAt?.toISOString() || null,
    createdAt:
      memberGuild.member.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: memberGuild.member.updatedAt?.toISOString() || null,
  };
}

export async function parseUserWithRoles(
  userId: string,
  guildId: string | Guild,
) {
  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const memberGuild = await prisma.memberGuild.findUnique({
    where: {
      member_guild: {
        memberId: userId,
        guildId: resolvedGuildId,
      },
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId: resolvedGuildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
  });

  if (!memberGuild || !memberGuild.status) return null;

  return formatMemberGuild(memberGuild, resolvedGuildId);
}

export async function parseMultipleUsersWithRoles(
  userIds: string[],
  guildId: string | Guild,
) {
  const resolvedGuildId = typeof guildId === "string" ? guildId : guildId.id;

  const members = await prisma.memberGuild.findMany({
    where: {
      memberId: { in: userIds },
      guildId: resolvedGuildId,
      status: true,
    },
    include: {
      member: {
        include: {
          roles: {
            where: { guildId: resolvedGuildId },
            orderBy: { position: "desc" },
          },
        },
      },
    },
  });

  const formattedMembers = members.map((memberGuild) =>
    formatMemberGuild(memberGuild, resolvedGuildId),
  );

  return formattedMembers.sort(
    (a, b) => b.highestRolePosition - a.highestRolePosition,
  );
}

export function parseMessage(message: Message, imagesOnly = false) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    attachments: Array.from(message.attachments.values())
      .filter((attachment) =>
        imagesOnly ? attachment.contentType?.startsWith("image/") : true,
      )
      .map((attachment) => ({
        url: attachment.url,
        ...(imagesOnly
          ? {
              width: attachment.width!,
              height: attachment.height!,
              contentType: attachment.contentType!,
            }
          : {
              name: attachment.name,
              contentType: attachment.contentType,
              size: attachment.size,
            }),
      })),
    embeds: message.embeds.map((embed) => ({
      title: embed.title,
      description: embed.description,
      url: embed.url,
      color: embed.color,
    })),
  };
}

export async function extractThreadDetails(
  thread: AnyThreadChannel,
  boardChannel: ForumChannel,
  guild: Guild,
  boardType: Static<typeof BoardType>,
) {
  const threadOwner = await parseUserWithRoles(thread.ownerId, guild);

  const tags = thread.appliedTags
    .map((tagId) => {
      const tag = boardChannel.availableTags.find((t) => t.id === tagId);
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
      const imageAttachment = starterMessage.attachments.find((attachment) =>
        attachment.contentType?.startsWith("image/"),
      );
      previewImage = imageAttachment?.url || null;
      previewText = starterMessage.content || null;
    }
  } catch (error) {}

  return {
    id: thread.id,
    name: thread.name,
    boardType,
    messageCount: thread.messageCount,
    author: threadOwner || null,
    archived: !!thread.archived,
    locked: thread.locked,
    createdAt: thread.createdAt?.toISOString() || null,
    tags,
    previewImage,
    previewText,
  };
}
