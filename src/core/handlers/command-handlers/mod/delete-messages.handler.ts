import type { Message, TextChannel } from "discord.js";
import { fetchMessages } from "@/core/services/messages/fetch-messages";

export async function executeDeleteMessages(
  channel: TextChannel,
  amount: number,
): Promise<void> {
  const messages = await fetchMessages(channel, amount);

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
    await channel.bulkDelete(batch, true);
  }
}
