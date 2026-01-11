import type { CommandInteraction, Message, TextChannel } from "discord.js";
import { MessagesService } from "@/core/services/messages/messages.service";
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

  for (const batch of messageList) {
    if ("bulkDelete" in channel) {
      await channel.bulkDelete(batch, true);
    }
  }

  return { success: true };
}
