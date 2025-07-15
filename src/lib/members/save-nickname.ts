import type { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../../prisma.js";

export const updateNickname = async (
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember,
) => {
  if (oldMember.user.bot) return;

  if (oldMember.nickname !== newMember.nickname) {
    const memberGuild = await prisma.memberGuild.findFirst({
      where: {
        guildId: newMember.guild.id,
        memberId: newMember.id,
      },
    });
    if (memberGuild) {
      await prisma.memberGuild.update({
        where: { id: memberGuild.id },
        data: { nickname: newMember.nickname },
      });
    }
  }
};
