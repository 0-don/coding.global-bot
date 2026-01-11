import type { APIEmbed } from "discord.js";
import { commandHistoryEmbed } from "@/core/embeds/command-history.embed";
import { prisma } from "@/prisma";

export async function executeLogCommandHistory(
  guildId: string,
  count: number,
): Promise<APIEmbed> {
  const history = await prisma.memberCommandHistory.findMany({
    where: { guildId },
    take: count,
    orderBy: { createdAt: "desc" },
  });

  return commandHistoryEmbed(history);
}
