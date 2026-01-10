import { ChannelType, ThreadChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ThreadService } from "../lib/threads/thread.service";

@Discord()
export class ThreadUpdate {
  @On({ event: "threadUpdate" })
  async threadUpdate(
    [oldThread, newThread]: ArgsOf<"threadUpdate">,
    client: Client,
  ) {
    // Only handle forum threads
    if (
      !newThread.parent ||
      newThread.parent.type !== ChannelType.GuildForum ||
      !(newThread instanceof ThreadChannel)
    ) {
      return;
    }

    const boardType = ThreadService.getBoardTypeFromChannel(newThread.parent);

    // Upsert the thread with updated data
    await ThreadService.upsertThread(newThread, boardType);
  }
}
