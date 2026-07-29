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
    `**Jailed by:** ${params.moderatorId ? `<@${params.moderatorId}>` : "System"}`,
  ].join("\n"),
  fields: [
    {
      name: "Proof",
      //  embed field caps at 1024 chars, truncate with ellipsis
      value: params.proofContent
        ? params.proofContent.length > 1020
          ? params.proofContent.slice(0, 1020) + "..."
          : params.proofContent
        : "no proof attached",
    },
  ],
  timestamp: new Date().toISOString(),
  footer: {
    text: "Jail System",
    icon_url: BOT_ICON,
  },
});
