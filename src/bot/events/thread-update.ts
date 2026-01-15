import { ThreadService } from "@/core/services/threads/thread.service";
import { ChannelType, ThreadChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class ThreadUpdate {
  @On({ event: "threadUpdate" })
  async threadUpdate(
    [oldThread, newThread]: ArgsOf<"threadUpdate">,
    client: Client,
  ) {
    console.log(
      "Thread updated:",
      newThread.parent?.name,
      newThread.parent?.id,
      newThread.parent?.type,
      newThread instanceof ThreadChannel,
    );
    // Only handle forum threads
    if (
      !newThread.parent ||
      newThread.parent.type !== ChannelType.GuildForum ||
      !(newThread instanceof ThreadChannel)
    ) {
      return;
    }

    const threadType = ThreadService.getThreadTypeFromChannel(newThread.parent);

    // Upsert the thread with updated data
    await ThreadService.upsertThread(newThread, threadType, {
      syncMessages: true,
    });
  }
}
