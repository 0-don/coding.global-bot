import { executeModLog } from "@/core/handlers/command-handlers/mod/modlog.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import type { CommandInteraction, User } from "discord.js";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class ModLog {
  @Slash({
    name: "modlog",
    description: "Recent moderation actions, optionally for one member",
    dmPermission: false,
  })
  async modlog(
    @SlashOption({
      name: "user",
      description: "Only show actions against this member",
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | undefined,
    interaction: CommandInteraction,
  ) {
    if (
      !(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] }))
    )
      return;

    const result = await executeModLog(interaction, user);

    await safeEditReply(interaction, {
      content: result.error ?? result.message ?? "Done.",
      allowedMentions: { users: [], roles: [] },
    });
  }
}
