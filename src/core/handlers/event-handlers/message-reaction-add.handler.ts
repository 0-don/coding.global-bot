import type { MessageReaction, User } from "discord.js";
import { HelperService } from "@/core/services/roles/helper.service";

export async function handleHelperReaction(
  reaction: MessageReaction,
  user: User,
): Promise<void> {
  try {
    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message;

    const channel = message.channel;

    if (!channel.isThread()) return;

    await HelperService.handleHelperReaction({
      threadId: channel.id,
      threadOwnerId: channel.ownerId,
      helperId: message.author!.id,
      thankerUserId: user.id,
      guildId: message.guildId!,
      message,
    });
  } catch (error) {
    console.error("Error in handleHelperReaction:", error);
  }
}
