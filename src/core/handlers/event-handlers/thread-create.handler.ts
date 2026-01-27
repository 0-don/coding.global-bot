import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { ThreadService } from "@/core/services/threads/thread.service";
import { getThreadWelcomeMessage } from "@/shared/config/branding";
import type { AnyThreadChannel } from "discord.js";
import { ChannelType, ThreadChannel } from "discord.js";

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

  if (newlyCreated) {
    try {
      const embed = simpleEmbedExample();
      embed.description = getThreadWelcomeMessage(
        threadType,
        thread.name,
        thread.id,
      );

      await thread.send({
        embeds: [embed],
        allowedMentions: { users: [], roles: [] },
      });
    } catch (_) {}
  }
}
