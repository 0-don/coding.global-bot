import { createCanvas } from "canvas";
import * as deepl from "deepl-node";

export const GLOBAL_CANVAS = createCanvas(1200, 400);
export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");
export const TRANSLATOR = new deepl.Translator(process.env.DEEPL);

export const HELPER_ROLES =
  process.env.HELPER_ROLES?.split(",").map((s) => s.trim()) || [];
export const STATUS_ROLES =
  process.env.STATUS_ROLES?.split(",").map((s) => s.trim()) || [];
export const MEMBER_ROLES = [
  ...(process.env.MEMBER_ROLES?.split(",").map((s) => s.trim()) || []),
  ...HELPER_ROLES,
];

export const HELPER_RANKING = HELPER_ROLES.map((role, i) => ({
  name: role,
  points: (i + 1) * 10,
}));

export const IS_CONSTRAINED_TO_BOT_CHANNEL =
  process.env.IS_CONSTRAINED_TO_BOT_CHANNEL.trim() === "true";

export const EVERYONE = "@everyone";
export const VERIFIED =
  STATUS_ROLES.find((r) => r.toLowerCase() === "verified") || STATUS_ROLES?.[0];
export const VOICE_ONLY =
  STATUS_ROLES.find((r) => r.toLowerCase() === "voiceonly") ||
  STATUS_ROLES?.[1];
export const JAIL =
  STATUS_ROLES.find((r) => r.toLowerCase() === "jail") || STATUS_ROLES?.[2];
export const UNVERIFIED =
  STATUS_ROLES.find((r) => r.toLowerCase() === "unverified") ||
  STATUS_ROLES?.[3];

export const GENERAL_CHANNEL = process.env.GENERAL_CHANNEL.trim();
export const VERIFY_CHANNEL = process.env.VERIFY_CHANNEL.trim();
export const BOT_CHANNEL = process.env.BOT_CHANNEL.trim();
export const VOICE_EVENT_CHANNEL = process.env.VOICE_EVENT_CHANNEL.trim();
export const JOIN_EVENTS_CHANNEL = process.env.JOIN_EVENTS_CHANNEL.trim();
export const MEMBERS_COUNT_CHANNEL = process.env.MEMBERS_COUNT_CHANNEL.trim();

export const MEMBERS_TEMPLATE = "members count";
export const STATS_TEMPLATE = "user stats";
export const TOP_STATS_TEMPLATE = "top stats";
export const VERIFY_TEMPLATE = "verify yourself";

export const RED_COLOR = parseInt("#FF0000") as number | undefined;
export const BOT_ICON = process.env.BOT_ICON.trim();
