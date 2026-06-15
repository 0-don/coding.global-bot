import { PrivacyService } from "@/core/services/privacy/privacy.service";
import type { CommandInteraction } from "discord.js";

export type PrivacyScope = "message" | "presence" | "all";

export async function executePrivacyStatus(
  interaction: CommandInteraction,
): Promise<string> {
  const memberId = interaction.member?.user.id;
  const guildId = interaction.guildId;
  if (!memberId || !guildId) return "This command only works in a server.";

  const flags = await PrivacyService.getFlags(memberId, guildId);

  return [
    "**Your Privacy Settings**",
    `Message content tracking: ${flags.messageOptOut ? "opted OUT" : "active"}`,
    `Presence tracking: ${flags.presenceOptOut ? "opted OUT" : "active"}`,
    "",
    "Use /privacy optout or /privacy optin with a scope (message, presence, all) to change this.",
    "Full policy: https://coding-global.com/en/privacy",
  ].join("\n");
}

export async function executePrivacyOptOut(
  interaction: CommandInteraction,
  scope: PrivacyScope,
): Promise<string> {
  const memberId = interaction.member?.user.id;
  const guildId = interaction.guildId;
  if (!memberId || !guildId) return "This command only works in a server.";

  const changed: string[] = [];

  if (scope === "message" || scope === "all") {
    await PrivacyService.setMessageOptOut(memberId, guildId, true);
    changed.push(
      "Message content: opted out. Existing stored messages, deleted-message logs, and help-thread posts have been deleted, and future message content will not be stored.",
    );
  }

  if (scope === "presence" || scope === "all") {
    await PrivacyService.setPresenceOptOut(memberId, guildId, true);
    changed.push(
      "Presence: opted out. Your stored status and activity have been cleared, and presence will no longer be tracked.",
    );
  }

  return ["**Opted Out**", ...changed].join("\n\n");
}

export async function executePrivacyOptIn(
  interaction: CommandInteraction,
  scope: PrivacyScope,
): Promise<string> {
  const memberId = interaction.member?.user.id;
  const guildId = interaction.guildId;
  if (!memberId || !guildId) return "This command only works in a server.";

  const changed: string[] = [];

  if (scope === "message" || scope === "all") {
    await PrivacyService.setMessageOptOut(memberId, guildId, false);
    changed.push("Message content tracking re-enabled.");
  }

  if (scope === "presence" || scope === "all") {
    await PrivacyService.setPresenceOptOut(memberId, guildId, false);
    changed.push("Presence tracking re-enabled.");
  }

  return ["**Opted In**", ...changed].join("\n");
}
