import { MessageReaction, User } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On, Reaction } from "discordx";
import { HelperService } from "../lib/roles/Helper.service.js";
import { RolesService } from "../lib/roles/Roles.service.js";
import { prisma } from "../prisma.js";

@Discord()
export class MessageReactionAdd {
  @On()
  async messageReactionAdd([reaction, user]: ArgsOf<"messageReactionAdd">, client: Client) {
    // fetch reaction status and roles
    await reaction.fetch();

    // add verify role on like reaction in verify template
    await RolesService.verifyReaction(reaction, user);

    return;
  }

  @Reaction({ emoji: "✅" })
  async helperEmojiAdd(reaction: MessageReaction, user: User): Promise<void> {
    const message = await reaction.message.fetch();
    const channel = message.channel;

    if (channel.isThread()) {
      const thread = await channel.fetch();
      const members = await message.guild?.members.fetch();
      const threadOwner = members?.get(thread.ownerId!);

      if (threadOwner?.id !== user?.id || threadOwner?.user.bot) {
        return;
      }

      if (threadOwner?.id === message.author?.id) return;

      const isHelpedThread = await prisma.memberHelper.findFirst({
        where: { threadId: thread.id, threadOwnerId: thread.ownerId },
      });

      if (isHelpedThread) return;

      await prisma.memberHelper.create({
        data: {
          memberId: message.author!.id,
          guildId: message.guildId!,
          threadId: thread.id,
          threadOwnerId: thread.ownerId,
        },
      });

      HelperService.helperRoleChecker(message);
    }
  }
}
