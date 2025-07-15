import {
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { translate } from "../../lib/helpers.js";
import { LogService } from "../../lib/logs/log.service.js";

@Discord()
export class Translate {
  @Slash({
    name: "translate",
    description: "Translate text to English",
  })
  async translate(
    @SlashOption({
      name: "text",
      description: "The text to translate",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    txt: string,
    interaction: CommandInteraction
  ) {
    // Defer reply if it takes longer than usual
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "translate");

    // Get lookback days from input
    const text = Buffer.from(txt, "utf-8").toString();

    const translatedText = await translate(text);

    // Send success message
    return await interaction.editReply({
      content: translatedText,
      allowedMentions: { users: [] },
    });
  }
}
