import type { CommandInteraction, Message, TextChannel } from "discord.js";
import { MessagesService } from "@/core/services/messages/messages.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { CommandResult } from "@/types";

export async function executeDeleteMessages(
  interaction: CommandInteraction,
  amount: number,
): Promise<CommandResult> {
  const channel = interaction.channel as TextChannel | null;
  if (!channel || !interaction.guildId) {
    return { success: false, error: "Invalid channel" };
  }

  const messages = await MessagesService.fetchMessages(channel, amount);

  const messageList = messages.reduce(
    (acc, message) => {
      const last = acc[acc.length - 1];
      if (last!.length === 100) {
        acc.push([message!]);
      } else {
        last!.push(message);
      }
      return acc;
    },
    [[]] as Message<boolean>[][],
  );

  let deleted = 0;
  for (const batch of messageList) {
    if ("bulkDelete" in channel) {
      const removed = await channel.bulkDelete(batch, true);
      deleted += removed.size;
    }
  }

  if (deleted > 0) {
    await ModLogService.record(channel.guild, {
      action: "Channel Purged",
      targetId: channel.id,
      moderatorId: interaction.user.id,
      amount: deleted,
    });
  }

  return { success: true };
}
