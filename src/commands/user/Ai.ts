import type { CommandInteraction, TextChannel, ThreadChannel } from "discord.js";
import { ApplicationCommandOptionType, ThreadAutoArchiveDuration } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { askChatGPT } from "../../chatgpt/askChatGPT.js";
import { chunkedSend } from "../../chatgpt/chunkedSend.js";

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
    interaction: CommandInteraction,
  ) {
    const user = interaction.user;
    const channel = interaction.channel as TextChannel;
    let thread: ThreadChannel | null = null;
    try {
      if (channel.isThread()) {
        await interaction.deferReply();
        const content = await askChatGPT({ interaction, user, text });

        if (!content) return await interaction.editReply("User not Found");

        return await chunkedSend({ content, interaction });
      }

      await interaction.deferReply({ ephemeral: true });
      thread = await channel.threads.create({
        name: `**${user.username}** - ${text}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      });
      const content = await askChatGPT({
        text,
        user,
      });

      if (!content) return await interaction.editReply("Chat GPT failed");

      await chunkedSend({ content, channel: thread });

      await interaction.editReply("Please continue the conversation in the thread below");
    } catch (error) {
      thread?.delete();

      return await interaction.editReply(JSON.stringify(error));
    }
  }
}
