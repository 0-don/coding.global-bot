import {
  ApplicationCommandOptionType,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeUserCommand } from "@/core/handlers/command-handlers/user/user.handler";
import { LogService } from "@/core/services/logs/log.service";

@Discord()
export class UserCommand {
  @Slash({
    name: "user",
    description: "Get stats from specific user",
    dmPermission: false,
  })
  async user(
    @SlashOption({
      name: "user",
      description: "Select user which stats should be shown",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "user");

    const result = await executeUserCommand(interaction, user.id);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
