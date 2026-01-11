import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeTrollMoveUser } from "@/core/handlers/command-handlers/admin/troll-move-user.handler";
import { LogService } from "@/core/services/logs/log.service";

@Discord()
export class TrollMoveUser {
  @Slash({
    name: "troll-move-user",
    description: "troll move user around empty voice channels",
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
    dmPermission: false,
  })
  async trollMoveUser(
    @SlashOption({
      name: "user",
      description: "Select either user which should be moved",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "count",
      description:
        "How many times should the user be moved, to disable set to 0",
      required: true,
      minValue: 0,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    count: number,
    @SlashOption({
      name: "timeout",
      description: "How long till channel unlock on move (seconds)",
      required: true,
      minValue: 0,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    timeout: number = 0,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    LogService.logCommandHistory(interaction, "troll-move-user");

    const result = await executeTrollMoveUser(
      user,
      count,
      timeout,
      interaction.user.id,
      interaction.guild!,
    );

    return interaction.editReply(result);
  }
}
