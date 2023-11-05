import { createCanvas } from "canvas";
import * as deepl from "deepl-node";

export const GLOBAL_CANVAS = createCanvas(1200, 400);
export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");
export const TRANSLATOR = new deepl.Translator(process.env.DEEPL!);

export const HELPER_ROLES = ["Helper", "Senior Helper", "Lead Helper"] as const;
export const STATUS_ROLES = ["Verified", "VoiceOnly", "Jail", "Unverified"] as const;
export const MEMBER_ROLES = ["Admin", "Owner", "Helper", "Member", ...HELPER_ROLES] as const;

export const HELPER_RANKING = [
  { name: HELPER_ROLES[0], points: 25 },
  { name: HELPER_ROLES[1], points: 50 },
  { name: HELPER_ROLES[2], points: 100 },
];

export const EVERYONE = "@everyone";
export const BUMPER = "Bumper";
export const VERIFIED = STATUS_ROLES[0];
export const VOICE_ONLY = STATUS_ROLES[1];
export const JAIL = STATUS_ROLES[2];
export const UNVERIFIED = STATUS_ROLES[3];

export const GENERAL_CHANNEL = "💬│𝖦𝖾𝗇𝖾𝗋𝖺𝗅";
export const VERIFY_CHANNEL = "✅│𝖵𝖾𝗋𝗂𝖿𝗒";
export const BOT_CHANNEL = "🤖│𝖡𝗈𝗍";
export const VOICE_EVENT_CHANNEL = "🔔│𝖵𝗈𝗂𝖼𝖾-𝖤𝗏𝖾𝗇𝗍𝗌";
export const JOIN_EVENTS_CHANNEL = "🌟│𝖩𝗈𝗂𝗇-𝖤𝗏𝖾𝗇𝗍𝗌";
export const MEMBERS_COUNT_CHANNEL = "𝖬𝖾𝗆𝖻𝖾𝗋𝗌:";

export const MEMBERS_TEMPLATE = "members count";
export const STATS_TEMPLATE = "user stats";
export const TOP_STATS_TEMPLATE = "top stats";
export const VERIFY_TEMPLATE = "verify yourself";

export const RED_COLOR = 0xff0000;
export const BOT_ICON =
  "https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png";
