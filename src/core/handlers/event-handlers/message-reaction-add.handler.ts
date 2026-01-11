import type { MessageReaction, User } from "discord.js";
import { HelperService } from "@/core/services/roles/helper.service";

export async function handleHelperReaction(
  reaction: MessageReaction,
  user: User,
): Promise<void> {
  try {
    const message = await reaction.message.fetch();
    const channel = message.channel;

    if (!channel.isThread()) return;

    const thread = await channel.fetch();

    await HelperService.handleHelperReaction({
      threadId: thread.id,
      threadOwnerId: thread.ownerId,
      helperId: message.author!.id,
      thankerUserId: user.id,
      guildId: message.guildId!,
      message,
    });
  } catch (error) {
    console.error("Error in handleHelperReaction:", error);
  }
}
