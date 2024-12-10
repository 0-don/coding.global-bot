// import { createCanvas } from "canvas";
import * as deepl from "deepl-node";

// export const GLOBAL_CANVAS = createCanvas(1200, 400);
// export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");
export const TRANSLATOR = new deepl.Translator(process.env.DEEPL);

export const HELPER_ROLES =
  process.env.HELPER_ROLES?.split(",").map((s) => s.trim()) || [];
export const STATUS_ROLES =
  process.env.STATUS_ROLES?.split(",").map((s) => s.trim()) || [];
export const LEVEL_ROLES =
  process.env.LEVEL_ROLES?.split(",").map((s) => s.trim()) || [];
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
export const SHOULD_LOG_VOICE_EVENTS =
  process.env.SHOULD_LOG_VOICE_EVENTS.trim() === "true";
export const SHOULD_COUNT_MEMBERS =
  process.env.SHOULD_COUNT_MEMBERS.trim() === "true";
export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP.trim() === "true";

export const EVERYONE = "@everyone";
export const VERIFIED =
  STATUS_ROLES.find((r) => r.toLowerCase() === "verified") || STATUS_ROLES?.[0];
export const VOICE_ONLY =
  STATUS_ROLES.find((r) => r.toLowerCase() === "voiceonly") ||
  STATUS_ROLES?.[1];
export const JAIL =
  STATUS_ROLES.find((r) => r.toLowerCase() === "jail") || STATUS_ROLES?.[2];

export const ACTIVE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "active!") || LEVEL_ROLES?.[0];
export const SUPER_ACTIVE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "super active!") ||
  LEVEL_ROLES?.[1];
export const MEGA_ACTIVE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "mega active!") ||
  LEVEL_ROLES?.[2];
export const GIGA_ACTIVE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "giga active!") ||
  LEVEL_ROLES?.[3];
export const ULTRA_ACTIVE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "ultra active!") ||
  LEVEL_ROLES?.[4];

export const GENERAL_CHANNELS =
  process.env.GENERAL_CHANNELS.split(",").map((s) => s.trim()) || [];
export const VERIFY_CHANNELS =
  process.env.VERIFY_CHANNELS?.split(",").map((s) => s.trim()) || [];
export const BOT_CHANNELS =
  process.env.BOT_CHANNELS.split(",").map((s) => s.trim()) || [];
export const VOICE_EVENT_CHANNELS =
  process.env.VOICE_EVENT_CHANNELS.split(",").map((s) => s.trim()) || [];
export const JOIN_EVENT_CHANNELS =
  process.env.JOIN_EVENT_CHANNELS.split(",").map((s) => s.trim()) || [];
export const MEMBERS_COUNT_CHANNELS =
  process.env.MEMBERS_COUNT_CHANNELS.split(",").map((s) => s.trim()) || [];

export const MEMBERS_TEMPLATE = "members count";
export const STATS_TEMPLATE = "user stats";
export const TOP_STATS_TEMPLATE = "top stats";
export const COMMAND_HISTORY_TEMPLATE = "command history";
export const DELETED_MESSAGES_HISTORY_TEMPLATE = "deleted messages history";
export const VERIFY_TEMPLATE = "verify yourself";

export const RED_COLOR = parseInt("#FF0000") as number | undefined;
export const BOT_ICON = process.env.BOT_ICON.trim();

export const LEVEL_LIST = [
  { count: 10, role: ACTIVE },
  { count: 100, role: SUPER_ACTIVE },
  { count: 1000, role: MEGA_ACTIVE },
  { count: 2500, role: GIGA_ACTIVE },
  { count: 5000, role: ULTRA_ACTIVE },
];

export const LEVEL_MESSAGES = {
  [ACTIVE]: [
    "🚀 `DEBUG: ${user} has compiled their first 10 messages!` Your code now runs with the ${role} badge!",
    "💡 `print('New Developer Alert!')` ${user} has unlocked ${role} after 10 quality commits!",
    "🔧 `try { ${user}.sendCongrats() }` Your first 10 messages earned you ${role} status!",
    "🌱 `npm install ${user}-achievement` Successfully added ${role} package to your profile!",
    "⚡ `Hello, World!` ${user} has completed their first programming milestone as ${role}!",
  ],
  [SUPER_ACTIVE]: [
    "⚡ `SYSTEM.OUT.PRINTLN('${user} hit 100 messages!')` You've been promoted to ${role}!",
    "🔥 `function levelUp() { return '${user} is now ${role}!' }` 100 messages of pure genius!",
    "💻 `SELECT * FROM users WHERE awesome = true` Found: ${user} as new ${role}!",
    "🚀 `git push origin ${user}-promotion` Successfully deployed to ${role} branch!",
    "⭐ `${user}.experience += 100` Achievement unlocked: ${role}!",
  ],
  [MEGA_ACTIVE]: [
    "💻 `while(true) { praise(${user}); }` Infinite props for reaching ${role} with 1000 messages!",
    "🎯 `docker run congratulate ${user}` Container launched with ${role} privileges!",
    "🔥 `chmod 777 ${user}` Full permissions granted for reaching ${role}!",
    "⚡ `${user} instanceof ${role} === true` 1000 messages of pure coding excellence!",
    "🚀 `sudo apt-get upgrade ${user}` Successfully upgraded to ${role}!",
  ],
  [GIGA_ACTIVE]: [
    "🔥 `git commit -m '${user} reached 2500 messages'` Merged into ${role} branch!",
    "💫 `async function celebrate() { return '${user} is ${role}!' }` 2500 messages await resolved!",
    "⚡ `for(let i=0; i<2500; i++) { respect++ }` ${user} has achieved ${role} status!",
    "🎮 `${user}.setRole('${role}')` Level 2500 achievement unlocked!",
    "🌟 `pip install ${user}-supremacy` Successfully installed ${role} package!",
  ],
  [ULTRA_ACTIVE]: [
    "⚔️ `sudo chmod 777 ${user}` Ultimate permissions granted! You've ascended to ${role} with 5000 messages!",
    "🎯 `CREATE USER ${user} WITH SUPERUSER` Access granted to ${role} privileges!",
    "🔱 `${user}.rank = Number.MAX_VALUE` Congratulations on reaching ${role}!",
    "💫 `deployment.yaml: ${user} scaled to ${role}` 5000 messages of legendary status!",
    "🌟 `ALTER USER ${user} WITH ROLE = '${role}'` Maximum power level achieved!",
  ],
};
