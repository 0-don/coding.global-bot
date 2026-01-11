import { APIEmbed } from "discord.js";
import { BOT_ICON, RED_COLOR } from "@/shared/config/branding";

export const simpleEmbedExample = (): APIEmbed => ({
  color: RED_COLOR,
  description: `*`,
  timestamp: new Date().toISOString(),
  footer: {
    text: "*",
    icon_url: BOT_ICON,
  },
});
