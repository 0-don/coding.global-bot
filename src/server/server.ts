import { Guild, GuildMember, Message } from "discord.js";
import { bot } from "../main";

function formatMemberData(fetchedMember: GuildMember, guild: Guild) {
  const roles = Array.from(fetchedMember.roles.cache.values())
    .filter((role) => role.id !== guild.id)
    .map((role) => ({ name: role.name, position: role.position }))
    .sort((a, b) => b.position - a.position);

  return {
    id: fetchedMember.user.id,
    username: fetchedMember.user.username,
    globalName: fetchedMember.user.globalName,
    displayName:
      fetchedMember.nickname ||
      fetchedMember.displayName ||
      fetchedMember.user.username,
    joinedAt: fetchedMember.joinedAt?.toISOString() || null,
    createdAt: fetchedMember.user.createdAt.toISOString(),
    displayAvatarURL: fetchedMember.user.displayAvatarURL({
      size: 512,
      extension: "webp",
    }),
    bannerUrl:
      fetchedMember.user.bannerURL({ size: 1024, extension: "webp" }) || null,
    displayHexColor: String(fetchedMember.displayHexColor || "#000000"),
    roles,
    highestRolePosition: roles[0]?.position || 0,
    status: String(fetchedMember.presence?.status || "offline"),
    activity: fetchedMember.presence?.activities?.[0]?.name || null,
  };
}

export async function parseUserWithRoles(
  userId: string,
  guildId: string | Guild,
  member?: GuildMember | Message,
) {
  const guild =
    typeof guildId === "string" ? bot.guilds.cache.get(guildId) : guildId;
  if (!guild) return null;

  const isMessage = member && "author" in member;
  const fetchedMember =
    (isMessage ? member.member : (member as GuildMember | undefined)) ||
    (await guild.members.fetch(userId).catch(() => null));

  if (!fetchedMember) return null;

  return formatMemberData(fetchedMember, guild);
}

export async function parseMultipleUsersWithRoles(
  userIds: string[],
  guildId: string | Guild,
) {
  const guild =
    typeof guildId === "string" ? bot.guilds.cache.get(guildId) : guildId;
  if (!guild) return [];

  const members = await guild.members
    .fetch({ user: userIds })
    .catch(() => null);
  if (!members) return [];

  const formattedMembers = Array.from(members.values()).map((fetchedMember) =>
    formatMemberData(fetchedMember, guild),
  );

  return formattedMembers.sort(
    (a, b) => b.highestRolePosition - a.highestRolePosition,
  );
}
