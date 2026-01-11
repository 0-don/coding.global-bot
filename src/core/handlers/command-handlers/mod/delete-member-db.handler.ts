import type { CommandInteraction } from "discord.js";
import { prisma } from "@/prisma";

export type DeleteMemberDbResult = {
  success: boolean;
  message: string;
};

export async function executeDeleteMemberDb(
  interaction: CommandInteraction,
  userId: string,
): Promise<DeleteMemberDbResult> {
  if (!interaction.guildId) {
    return {
      success: false,
      message: "This command can only be used in a server",
    };
  }

  try {
    await prisma.memberGuild.delete({
      where: {
        member_guild: {
          memberId: userId,
          guildId: interaction.guildId,
        },
      },
    });

    const otherGuildCount = await prisma.memberGuild.count({
      where: { memberId: userId },
    });

    if (otherGuildCount === 0) {
      await prisma.member.delete({
        where: { memberId: userId },
      });
    }

    return {
      success: true,
      message: `User data deleted from this server${
        otherGuildCount === 0 ? " (and global profile removed)" : ""
      }`,
    };
  } catch (_) {
    return {
      success: false,
      message: "User not found in this server",
    };
  }
}
