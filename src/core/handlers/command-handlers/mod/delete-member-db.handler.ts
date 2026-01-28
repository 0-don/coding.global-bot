import type { CommandInteraction } from "discord.js";
import { db } from "@/lib/db";
import { member, memberGuild } from "@/lib/db-schema";
import { and, count, eq } from "drizzle-orm";

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
    await db.delete(memberGuild)
      .where(
        and(
          eq(memberGuild.memberId, userId),
          eq(memberGuild.guildId, interaction.guildId),
        )
      );

    const [otherGuildResult] = await db
      .select({ count: count() })
      .from(memberGuild)
      .where(eq(memberGuild.memberId, userId));

    const otherGuildCount = otherGuildResult?.count ?? 0;

    if (otherGuildCount === 0) {
      await db.delete(member).where(eq(member.memberId, userId));
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
