import { MessageReaction, User } from "discord.js";
import { Discord, Reaction } from "discordx";
import { handleHelperReaction } from "@/core/handlers/event-handlers/message-reaction-add.handler";

@Discord()
export class MessageReactionAdd {
  @Reaction({ emoji: "✅" })
  async helperEmojiAdd(reaction: MessageReaction, user: User): Promise<void> {
    await handleHelperReaction(reaction, user);
  }
}
