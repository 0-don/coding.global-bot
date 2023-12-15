import { error } from "console";
import type {
  Attachment,
  CommandInteraction,
  GuildMember,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import {
  ApplicationCommandOptionType,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { askAi } from "../../chatgpt/askAi.js";
import { MEMBER_ROLES } from "../../lib/constants.js";

@Discord()
export class Ai {
  @Slash({ name: "ai", description: "talk to ai" })
  async ai(
    @SlashOption({
      name: "text",
      description: "ask ai a question",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    text: string,
    @SlashOption({
      name: "image",
      description: "upload an image to ai (member only)",
      required: false,
      type: ApplicationCommandOptionType.Attachment,
    })
    image: Attachment,
    interaction: CommandInteraction,
  ) {
    let fileLink: string | undefined = undefined;
    if (image?.contentType?.startsWith("image")) {
      const userRoles = (
        await (await interaction.guild?.members.fetch())
          ?.get(interaction.user.id)
          ?.fetch()
      )?.roles.cache;
      if (!userRoles?.some((r) => MEMBER_ROLES.includes(r.name as any)))
        return await interaction.reply(
          "You need to be a member to upload an image",
        );
      fileLink = new URL(image.url).origin + new URL(image.url).pathname;
    }

    try {
      const channel = interaction.channel as TextChannel | ThreadChannel;
      if (process.env.NODE_ENV !== "production") {
        await interaction.deferReply();
        return await askAi({
          channel,
          interaction,
          user: interaction.user,
          text,
          fileLink,
          withHeaders: true,
        });
      }

      if (channel.isThread()) {
        await interaction.deferReply();
        return await askAi({
          channel,
          interaction,
          user: interaction.user,
          text,
          fileLink,
          withHeaders: true,
        });
      } else {
        await interaction.deferReply({ ephemeral: true });
        const thread = await this.createThread(
          channel as TextChannel,
          interaction.member as GuildMember,
          text,
        );
        askAi({
          channel: thread,
          user: interaction.user,
          text,
          fileLink,
          withHeaders: true,
        });
        await interaction.editReply(
          "Please continue the conversation in the thread below",
        );
      }
    } catch (err) {
      error(err);
      await interaction.editReply(
        "An error occurred while processing your request.",
      );
    }
  }

  private async createThread(
    channel: TextChannel,
    member: GuildMember,
    text: string,
  ): Promise<ThreadChannel> {
    const threadName = `${member.displayName}: ${text.substring(0, 50)}`;
    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });

    await thread.members.add(member.id);
    return thread;
  }
}
