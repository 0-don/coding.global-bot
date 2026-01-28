import { executeTranslateCommand } from "@/core/handlers/command-handlers/user/translate.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import {
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Translate {
  @Slash({
    name: "translate",
    description: "Translate text to English",
    dmPermission: false,
  })
  async translate(
    @SlashOption({
      name: "text",
      description: "The text to translate",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    txt: string,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "translate",
        })
        .catch(() => {});
    }

    const result = await executeTranslateCommand(txt);

    if ("error" in result) {
      await safeEditReply(interaction, {
        content: result.error,
        allowedMentions: { users: [], roles: [] },
      });
      return;
    }

    await safeEditReply(interaction, {
      content: result.text,
      allowedMentions: { users: [], roles: [] },
    });
  }
}
