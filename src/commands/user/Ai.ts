import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
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
    await interaction.deferReply();

    const user = interaction.user;
    try {
      const content = await askChatGPT({ interaction, user, text });

      if (!content) return await interaction.editReply("User not Found");

      return await chunkedSend({ content, interaction });
    } catch (error) {
      console.log(error);
      return await interaction.editReply(JSON.stringify(error));
    }
  }
}