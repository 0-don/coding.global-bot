import { ChannelType, ThreadChannel } from "discord.js";
import type { AnyThreadChannel } from "discord.js";
import { ThreadService } from "@/core/services/threads/thread.service";

export async function handleThreadCreate(
  thread: AnyThreadChannel,
  newlyCreated: boolean,
): Promise<void> {
  if (
    !thread.parent ||
    thread.parent.type !== ChannelType.GuildForum ||
    !(thread instanceof ThreadChannel)
  ) {
    return;
  }

  const threadType = ThreadService.getThreadTypeFromChannel(thread.parent);

  await ThreadService.upsertTags(thread.guildId, thread.parent.availableTags);

  await ThreadService.upsertThread(thread, threadType, { syncMessages: true });
}
