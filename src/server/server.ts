import { Guild, GuildMember, Message } from "discord.js";
import { bot } from "../main";

/**
 * Parses user data with their roles and positions from Discord
 * @param userId - Discord user ID
 * @param guildId - Discord guild ID (or guild object)
 * @param member - Optional pre-fetched member object (for batch operations)
 */
export async function parseUserWithRoles(
  userId: string,
  guildId: string | Guild,
  member?: GuildMember | Message,
) {
  const guild =
    typeof guildId === "string" ? bot.guilds.cache.get(guildId) : guildId;
  if (!guild) return null;

  // Determine if member is a Message or GuildMember
  const isMessage = member && "author" in member;
  const guildMember = isMessage
    ? member.member
    : (member as GuildMember | undefined);

  // If member not provided, fetch it
  let fetchedMember = guildMember;
  if (!fetchedMember) {
    fetchedMember = (await guild.members
      .fetch(userId)
      .catch(() => null)) as GuildMember | null;
  }

  // Get user from either Message or GuildMember
  const user = isMessage ? (member as Message).author : fetchedMember?.user;
  if (!user || !fetchedMember) return null;

  // Get roles directly from Discord member and map to our format
  const roles = Array.from(fetchedMember.roles.cache.values())
    .filter((role) => role.id !== guild.id) // Exclude @everyone role
    .map((role) => ({
      name: role.name,
      position: role.position,
    }))
    .sort((a, b) => b.position - a.position);

  // Get highest role position
  const highestRolePosition = roles.length > 0 ? roles[0].position : 0;

  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    displayName:
      fetchedMember?.nickname || fetchedMember?.displayName || user.username,
    joinedAt: fetchedMember?.joinedAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
    displayAvatarURL: user.displayAvatarURL({
      size: 512,
      extension: "webp",
    }),
    bannerUrl: user.bannerURL({ size: 512, extension: "webp" }) || null,
    displayHexColor: String(fetchedMember?.displayHexColor || "#000000"),
    roles,
    highestRolePosition,
    status: String(fetchedMember?.presence?.status || "offline"),
    activity: fetchedMember?.presence?.activities?.[0]?.name || null,
  };
}
