import { MessageReaction, User } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On, Reaction } from "discordx";
import { HelperService } from "@/core/services/roles/helper.service";
import { RolesService } from "@/core/services/roles/roles.service";

@Discord()
export class MessageReactionAdd {
  @On()
  async messageReactionAdd(
    [reaction, user]: ArgsOf<"messageReactionAdd">,
    client: Client,
  ) {
    await reaction.fetch();
    await RolesService.verifyReaction(reaction, user);
  }

  @Reaction({ emoji: "✅" })
  async helperEmojiAdd(reaction: MessageReaction, user: User): Promise<void> {
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
      console.error("Error in helperEmojiAdd:", error);
    }
  }
}
