import {
  ApplicationCommandOptionType,
  TextChannel,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../../lib/constants.js";
import { Ai_prompt } from "./prompt.js";


@Discord()
export class AskToAI {
  @Slash({
    name: "ask",
    description: "I have ai brain, ask me something!",
  })
  async ask(
    @SlashOption({
      name: "prompt",
      description: 'Type your question or personalized prompt',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    prompt: string,
    interaction: CommandInteraction,
  ) {
    const channel = (await interaction.channel?.fetch()) as TextChannel;
    await interaction.deferReply();


    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      if (!BOT_CHANNELS.includes(channel.name))
        return await interaction.editReply(
          "Please go to bots channel, lets keep the things simple and organized",
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('API KEY missing');
      return await interaction.editReply('Error:  API key is missing.');
        }

        try {
      const body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: Ai_prompt.promptText + 'knowing that, please reply: ' + prompt }] }],
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Gemini error: ${res.status} ${errorText}`);
        return await interaction.editReply('Sorry i cant reply rn.');
      }

      const data = await res.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return await interaction.editReply(responseText || 'Could not generate a response.');
        } catch (error) {
      console.error('Error calling Gemini:', error);
      return await interaction.editReply('An error occurred while processing your message.');
        }
  }
}

// ,---,---,---,---,---,---,---,---,---,---,---,---,---,-------,
// |1/2| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 | + | ' | <-    |
// |---'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-----|
// | ->| | Q | W | E | R | T | Y | U | I | O | P | ] | ^ |     |
// |-----',--',--',--',--',--',--',--',--',--',--',--',--'|    |
// | Caps | A | S | D | F | G | H | J | K | L | \ | [ | * |    |
// |----,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'-,-'---'----|
// |    | < | Z | X | C | V | B | N | M | , | . | - |          |
// |----'-,-',--'--,'---'---'---'---'---'---'-,-'---',--,------|
// | ctrl |  | alt |                          |altgr |  | ctrl |
// '------'  '-----'--------------------------'------'  '------'
// TOKYO WAS HEREEE!