import {
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { translate } from "../../lib/helpers.js";
import { LogService } from "../../lib/logs/Log.service.js";

@Discord()
export class Translate {
  @Slash({
    name: "translate",
    description: "translate text to english",
  })
  async translate(
    @SlashOption({
      name: "text",
      description: "the text to translate",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    txt: string,
    interaction: CommandInteraction
  ) {
    // deferReply if it takes longer then usual
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "translate");

    // get lookback days from input
    const text = Buffer.from(txt, "utf-8").toString();

    const translatedText = await translate(text);

    // send success message
    return await interaction.editReply({
      content: translatedText,
      allowedMentions: { users: [] },
    });
  }
}
