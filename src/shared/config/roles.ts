// Role configurations parsed from environment variables

export const BOT_OWNER_ID = "1302775229923332119";

export const STAFF_ROLES =
  process.env.STAFF_ROLES?.split(",").map((s) => s.trim()) || [];

export const HELPER_ROLES =
  process.env.HELPER_ROLES?.split(",").map((s) => s.trim()) || [];

export const STATUS_ROLES =
  process.env.STATUS_ROLES?.split(",").map((s) => s.trim()) || [];

export const LEVEL_ROLES =
  process.env.LEVEL_ROLES?.split(",").map((s) => s.trim()) || [];

export const MEMBER_ROLES = process.env.MEMBER_ROLES?.split(",").map((s) => s.trim()) || [];

export const HELPER_RANKING = HELPER_ROLES.map((role, i) => ({
  name: role,
  points: (i + 1) * 10,
}));

// Status role names
export const EVERYONE = "@everyone";

export const VERIFIED =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "verified") ||
  STATUS_ROLES?.[0];

export const VOICE_ONLY =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "voiceonly") ||
  STATUS_ROLES?.[1];

export const JAIL =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "jail") || STATUS_ROLES?.[2];

// Level role names
export const SCRIPT_KIDDIE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "script kiddie!") ||
  LEVEL_ROLES?.[0];

export const COPY_PASTER =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "copy paster!") ||
  LEVEL_ROLES?.[1];

export const VIBE_CODER =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "vibe coder!") ||
  LEVEL_ROLES?.[2];

export const INTERN =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "intern!") || LEVEL_ROLES?.[3];

export const JUNIOR_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "junior dev!") ||
  LEVEL_ROLES?.[4];

export const MID_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "mid dev!") || LEVEL_ROLES?.[5];

export const SENIOR_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "senior dev!") ||
  LEVEL_ROLES?.[6];

export const LEAD_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "lead dev!") || LEVEL_ROLES?.[7];

export const TECH_LEAD =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "tech lead!") || LEVEL_ROLES?.[8];
