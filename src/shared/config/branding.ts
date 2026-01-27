// Branding and visual constants

export const MEMBERS_TEMPLATE = "members count";
export const STATS_TEMPLATE = "user stats";
export const TOP_STATS_TEMPLATE = "top stats";
export const COMMAND_HISTORY_TEMPLATE = "command history";
export const DELETED_MESSAGES_HISTORY_TEMPLATE = "deleted messages history";

export const RED_COLOR = 0xff0000;
export const BOT_ICON =
  process.env.BOT_ICON?.trim() || "https://via.placeholder.com/32";

// Bot messages
const CODING_RESPONSE =
  "Thanks for your question :clap:, if someone gives you an answer it would be great if you thanked them with a :white_check_mark: in response. This response will earn you both points for special roles on this server.";

export function getThreadWelcomeMessage(
  boardType: string,
  threadName: string,
  threadId: string,
): string {
  const link = `[${threadName}](https://coding.global/${threadId})`;

  switch (boardType) {
    case "job-board":
      return `Good luck finding the right candidate! :four_leaf_clover:\n\n:link: ${link}`;
    case "dev-board":
      return `Hope you find the perfect match! :handshake:\n\n:link: ${link}`;
    case "showcase":
      return `Thanks for sharing your project! :star2:\n\n:link: ${link}`;
    default:
      return `${CODING_RESPONSE}\n\n:link: ${link}`;
  }
}
