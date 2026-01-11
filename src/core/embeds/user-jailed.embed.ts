import { APIEmbed } from "discord.js";
import { BOT_ICON, RED_COLOR } from "@/shared/config/branding";
import type { UserJailedEmbedParams } from "@/types";

export const userJailedEmbed = (params: UserJailedEmbedParams): APIEmbed => ({
  color: RED_COLOR ?? 0xff0000,
  title: "User Jailed",
  description: [
    `**User:** <@${params.memberId}>`,
    `**Username:** ${params.displayName} (${params.username})`,
    `**Member ID:** ${params.memberId}`,
    `**Reason:** ${params.reason || "No reason provided"}`,
  ].join("\n"),
  timestamp: new Date().toISOString(),
  footer: {
    text: "Jail System",
    icon_url: BOT_ICON,
  },
});
