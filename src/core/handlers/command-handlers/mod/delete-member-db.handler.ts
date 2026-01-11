import { prisma } from "@/prisma";

export type DeleteMemberDbResult = {
  success: boolean;
  message: string;
};

export async function executeDeleteMemberDb(
  userId: string,
  guildId: string,
): Promise<DeleteMemberDbResult> {
  try {
    await prisma.memberGuild.delete({
      where: {
        member_guild: {
          memberId: userId,
          guildId: guildId,
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
