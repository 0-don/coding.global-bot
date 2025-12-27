import { AnyThreadChannel, ForumChannel, Guild, Message } from "discord.js";
import { Static, status, t } from "elysia";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../prisma";

export const PAGE_LIMIT = 100;
export const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const BoardType = t.Union([
  t.Literal("job-board"),
  t.Literal("dev-board"),
  t.Literal("showcase"),
]);

export const ThreadParams = t.Object({
  guildId: t.String(),
  boardType: BoardType,
  threadId: t.String(),
});

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

  if (!memberGuild) return null;

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

export function parseMessage(message: Message) {
  return {
    // Basic info
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),

    // Message metadata
    editedAt: message.editedAt?.toISOString() || null,
    pinned: message.pinned,
    tts: message.tts,
    type: message.type.toString(),

    // Attachments
    attachments: Array.from(message.attachments.values()).map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      proxyURL: attachment.proxyURL,
      name: attachment.name,
      description: attachment.description || null,
      contentType: attachment.contentType || null,
      size: attachment.size,
      width: attachment.width || null,
      height: attachment.height || null,
      ephemeral: attachment.ephemeral,
      duration: attachment.duration || null,
      waveform: attachment.waveform || null,
      flags: attachment.flags?.bitfield.toString() || null,
    })),

    // Embeds
    embeds: message.embeds.map((embed) => ({
      title: embed.title || null,
      description: embed.description || null,
      url: embed.url || null,
      color: embed.color || null,
      timestamp: embed.timestamp || null,
      fields: embed.fields.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      })),
      author: embed.author
        ? {
            name: embed.author.name,
            url: embed.author.url || null,
            iconURL: embed.author.iconURL || null,
            proxyIconURL: embed.author.proxyIconURL || null,
          }
        : null,
      thumbnail: embed.thumbnail
        ? {
            url: embed.thumbnail.url,
            proxyURL: embed.thumbnail.proxyURL || null,
            width: embed.thumbnail.width || null,
            height: embed.thumbnail.height || null,
          }
        : null,
      image: embed.image
        ? {
            url: embed.image.url,
            proxyURL: embed.image.proxyURL || null,
            width: embed.image.width || null,
            height: embed.image.height || null,
          }
        : null,
      video: embed.video
        ? {
            url: embed.video.url || null,
            proxyURL: embed.video.proxyURL || null,
            width: embed.video.width || null,
            height: embed.video.height || null,
          }
        : null,
      footer: embed.footer
        ? {
            text: embed.footer.text,
            iconURL: embed.footer.iconURL || null,
            proxyIconURL: embed.footer.proxyIconURL || null,
          }
        : null,
      provider: embed.provider
        ? {
            name: embed.provider.name || null,
            url: embed.provider.url || null,
          }
        : null,
    })),

    // Interaction data
    mentions: {
      users: message.mentions.users.map((user) => ({
        id: user.id,
        username: user.username,
        globalName: user.globalName,
      })),
      roles: message.mentions.roles.map((role) => ({
        id: role.id,
        name: role.name,
      })),
      everyone: message.mentions.everyone,
    },
    reactions: message.reactions.cache.map((reaction) => ({
      emoji: {
        id: reaction.emoji.id,
        name: reaction.emoji.name,
      },
      count: reaction.count,
    })),
    reference: message.reference
      ? {
          messageId: message.reference.messageId || null,
          channelId: message.reference.channelId,
          guildId: message.reference.guildId || null,
        }
      : null,
  };
}

export async function fetchThreadFromGuild(
  guild: Guild,
  threadId: string,
): Promise<AnyThreadChannel> {
  let thread = guild.channels.cache.get(threadId);

  // Try to fetch the thread from Discord API if not in cache
  if (!thread?.isThread()) {
    try {
      const fetchedThread = await guild.channels.fetch(threadId);
      if (!fetchedThread?.isThread()) {
        throw status("Not Found", "Thread not found");
      }
      thread = fetchedThread;
    } catch (err) {
      throw status("Not Found", "Thread not found or was deleted");
    }
  }

  return thread;
}

export async function extractThreadDetails(
  thread: AnyThreadChannel,
  boardChannel: ForumChannel,
  guild: Guild,
  boardType: Static<typeof BoardType>,
) {
  const author = await parseUserWithRoles(thread.ownerId, guild);

  if (!author) return null!;

  const tags = thread.appliedTags
    .map((tagId) => {
      const tag = boardChannel.availableTags.find((t) => t.id === tagId);
      return {
        id: tag!.id,
        name: tag!.name,
        emoji: {
          id: tag?.emoji?.id || null,
          name: tag?.emoji?.name || null,
        },
      };
    })
    .filter(Boolean);

  let imageUrl: string | null = null;
  let content: string | null = null;
  try {
    const starterMessage = await thread.fetchStarterMessage();
    if (starterMessage) {
      const imageAttachment = starterMessage.attachments.find((attachment) =>
        attachment.contentType?.startsWith("image/"),
      );
      imageUrl = imageAttachment?.url || null;
      content = starterMessage.content || null;
    }
  } catch (error) {}

  return {
    // Basic info
    id: thread.id,
    name: thread.name,
    boardType,
    parentId: thread.parentId,

    // Author & metadata
    author,
    createdAt: thread.createdAt?.toISOString() || null,
    tags,

    // Content preview
    content,
    imageUrl,

    // Statistics
    messageCount: thread.messageCount || 0,
    totalMessageSent: thread.totalMessageSent || 0,
    memberCount: thread.memberCount || 0,

    // Thread settings
    locked: !!thread.locked,
    archived: !!thread.archived,
    archivedAt: thread.archiveTimestamp
      ? new Date(thread.archiveTimestamp).toISOString()
      : null,
    autoArchiveDuration: thread.autoArchiveDuration?.toString() || null,
    invitable: thread.invitable,
    rateLimitPerUser: thread.rateLimitPerUser,
    flags: thread.flags.bitfield,
  };
}
