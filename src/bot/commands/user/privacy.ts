import {
  executePrivacyOptIn,
  executePrivacyOptOut,
  executePrivacyStatus,
  type PrivacyScope,
} from "@/core/handlers/command-handlers/user/privacy.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";

@Discord()
@SlashGroup({
  name: "privacy",
  description: "Manage how your data is tracked",
  dmPermission: false,
})
@SlashGroup("privacy")
export class PrivacyCommand {
  @Slash({
    name: "status",
    description: "Show your current message and presence tracking settings",
  })
  async status(interaction: CommandInteraction) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    const content = await executePrivacyStatus(interaction);
    await safeEditReply(interaction, { content });
  }

  @Slash({
    name: "optout",
    description: "Stop the bot tracking your message content and/or presence",
  })
  async optout(
    @SlashChoice({ name: "message content", value: "message" })
    @SlashChoice({ name: "presence", value: "presence" })
    @SlashChoice({ name: "all", value: "all" })
    @SlashOption({
      name: "scope",
      description: "What to opt out of",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    scope: PrivacyScope,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    const content = await executePrivacyOptOut(interaction, scope);
    await safeEditReply(interaction, { content });
  }

  @Slash({
    name: "optin",
    description: "Re-enable tracking of your message content and/or presence",
  })
  async optin(
    @SlashChoice({ name: "message content", value: "message" })
    @SlashChoice({ name: "presence", value: "presence" })
    @SlashChoice({ name: "all", value: "all" })
    @SlashOption({
      name: "scope",
      description: "What to opt back in to",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    scope: PrivacyScope,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    const content = await executePrivacyOptIn(interaction, scope);
    await safeEditReply(interaction, { content });
  }
}
