import type { APIEmbed } from "discord.js";
import { deletedMessagesHistoryEmbed } from "@/core/embeds/deleted-messages.embed";
import { prisma } from "@/prisma";

export async function executeLogDeletedMessagesHistory(
  guildId: string,
  count: number,
): Promise<APIEmbed> {
  const history = await prisma.memberDeletedMessages.findMany({
    where: { guildId },
    take: count,
    orderBy: { createdAt: "desc" },
  });

  return deletedMessagesHistoryEmbed(history);
}
