import { ChannelType, ThreadChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ThreadService } from "@/core/services/threads/thread.service";

@Discord()
export class ThreadCreate {
  @On({ event: "threadCreate" })
  async threadCreate(
    [thread, newlyCreated]: ArgsOf<"threadCreate">,
    client: Client,
  ) {
    // Only handle forum threads
    if (
      !thread.parent ||
      thread.parent.type !== ChannelType.GuildForum ||
      !(thread instanceof ThreadChannel)
    ) {
      return;
    }

    const boardType = ThreadService.getBoardTypeFromChannel(thread.parent);

    // Sync tags for this forum (in case new tags were added)
    await ThreadService.upsertTags(
      thread.guildId,
      thread.parent.availableTags,
    );

    // Upsert the thread
    await ThreadService.upsertThread(thread, boardType);
  }
}
