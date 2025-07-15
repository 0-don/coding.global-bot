import {
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { translate } from "../../lib/helpers";
import { LogService } from "../../lib/logs/log.service";
import { ConfigValidator } from "../../lib/config-validator";

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

    if (!ConfigValidator.isFeatureEnabled("DEEPL")) {
      ConfigValidator.logFeatureDisabled("Translation", "DEEPL");
      return await interaction.editReply({
        content:
          "Translation feature is not configured. Please contact an administrator.",
        allowedMentions: { users: [] },
      });
    }

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
