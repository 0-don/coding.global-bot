import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { askChatGPT } from "../modules/chatgpt/askChatGPT.js";
import { chunkedSend } from "../modules/messages/chunkedSend.js";

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

    const content = await askChatGPT({ interaction, user, text });

    if (!content) return await interaction.editReply("User not Found");

    return await chunkedSend({ content, interaction });
  }
}
