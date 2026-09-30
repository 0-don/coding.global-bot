import { BOT_ICON } from "@/shared/config/branding";
import type { APIEmbed, User } from "discord.js";

/**
 * Discord's own palette, so logs sit naturally in the client instead of
 * clashing with it.
 *
 * Deliberately separate from RED_COLOR and friends: those are the flat theme
 * colour used by every informational embed (/time, /me, /top), and recolouring
 * those would be a change nobody asked for. This applies to log embeds only,
 * where telling a join from a ban at a glance is the whole point.
 */
export const LOG_COLORS = {
  positive: 0x57f287, // joined, unbanned, timeout lifted
  negative: 0xed4245, // left, kicked, banned, jailed, deleted
  caution: 0xfee75c, // edited, warned, timed out
  neutral: 0x5865f2, // nickname changes, voice movement
} as const;

export type LogTone = keyof typeof LOG_COLORS;

export function logEmbed(params: {
  tone: LogTone;
  /** Bold first line - the thing that happened. */
  title: string;
  /** Puts the member's face on the entry, which is what makes a log skimmable. */
  user?: User | null;
  lines?: (string | null | undefined)[];
  footer: string;
}): APIEmbed {
  const body = (params.lines ?? []).filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  );

  return {
    color: LOG_COLORS[params.tone],
    author: params.user
      ? {
          name: params.user.username,
          icon_url: params.user.displayAvatarURL(),
        }
      : undefined,
    description: [`**${params.title}**`, ...body].join("\n"),
    timestamp: new Date().toISOString(),
    footer: { text: params.footer, icon_url: BOT_ICON },
  };
}
