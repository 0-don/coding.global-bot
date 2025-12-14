import { Guild, GuildMember, Message } from "discord.js";
import { bot } from "../main";

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

  const fullUser = await bot.users
    .fetch(userId, { force: true })
    .catch(() => fetchedMember.user);

  const roles = Array.from(fetchedMember.roles.cache.values())
    .filter((role) => role.id !== guild.id)
    .map((role) => ({ name: role.name, position: role.position }))
    .sort((a, b) => b.position - a.position);

  return {
    id: fullUser.id,
    username: fullUser.username,
    globalName: fullUser.globalName,
    displayName:
      fetchedMember.nickname || fetchedMember.displayName || fullUser.username,
    joinedAt: fetchedMember.joinedAt?.toISOString() || null,
    createdAt: fullUser.createdAt.toISOString(),
    displayAvatarURL: fullUser.displayAvatarURL({
      size: 512,
      extension: "webp",
    }),
    bannerUrl: fullUser.bannerURL({ size: 1024, extension: "webp" }) || null,
    displayHexColor: String(fetchedMember.displayHexColor || "#000000"),
    roles,
    highestRolePosition: roles[0]?.position || 0,
    status: String(fetchedMember.presence?.status || "offline"),
    activity: fetchedMember.presence?.activities?.[0]?.name || null,
  };
}
