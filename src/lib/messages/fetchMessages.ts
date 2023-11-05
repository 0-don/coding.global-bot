import type {
  Collection,
  FetchMessagesOptions,
  Message,
  PrivateThreadChannel,
  PublicThreadChannel,
  TextChannel,
} from "discord.js";

export async function fetchMessages(
  channel: TextChannel | PrivateThreadChannel | PublicThreadChannel<boolean>,
  limit: number = 100,
): Promise<Message[]> {
  let out: Message[] = [];
  if (limit <= 100) {
    let messages: Collection<string, Message> = await channel.messages.fetch({
      limit: limit,
    });
    const messagesArray = Array.from(messages.values(), (value) => value);
    out.push(...messagesArray);
  } else {
    const rounds = limit / 100 + (limit % 100 ? 1 : 0);
    let lastId: string = "";
    for (let x = 0; x < rounds; x++) {
      const options: FetchMessagesOptions = {
        limit: 100,
      };

      if (lastId.length > 0) options.before = lastId;

      const messages: Collection<string, Message> = await channel.messages.fetch(options);

      const messagesArray = Array.from(messages.values(), (value) => value);
      out.push(...messagesArray);

      lastId = messagesArray[messagesArray.length - 1]?.id || "";
    }
  }
  // remove duplicates
  return out.filter((message, index, self) => self.findIndex((m) => m.id === message.id) === index);
}
