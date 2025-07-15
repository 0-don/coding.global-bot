import { createCanvas } from "canvas";
import { Chart } from "chart.js";
import * as deepl from "deepl-node";
import { ConfigValidator } from "./config-validator";

export const GLOBAL_CANVAS = createCanvas(1200, 400);
export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");
export const TRANSLATOR = ConfigValidator.isFeatureEnabled("DEEPL")
  ? new deepl.Translator(process.env.DEEPL)
  : null;

let _GLOBAL_CHART: Chart | null = null;

export const ChartManager = {
  getChart: () => _GLOBAL_CHART,
  setChart: (chart: Chart<any, any> | null) => {
    if (_GLOBAL_CHART) {
      _GLOBAL_CHART.destroy();
    }
    _GLOBAL_CHART = chart;
  },
  destroyChart: () => {
    if (_GLOBAL_CHART) {
      _GLOBAL_CHART.destroy();
      _GLOBAL_CHART = null;
    }
  },
};
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
  process.env.IS_CONSTRAINED_TO_BOT_CHANNEL?.trim() === "true";
export const SHOULD_LOG_VOICE_EVENTS =
  process.env.SHOULD_LOG_VOICE_EVENTS?.trim() === "true";
export const SHOULD_COUNT_MEMBERS =
  process.env.SHOULD_COUNT_MEMBERS?.trim() === "true";
export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP?.trim() === "true";

export const EVERYONE = "@everyone";
export const VERIFIED =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "verified") ||
  STATUS_ROLES?.[0];
export const VOICE_ONLY =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "voiceonly") ||
  STATUS_ROLES?.[1];
export const JAIL =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "jail") || STATUS_ROLES?.[2];

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
  process.env.GENERAL_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
export const VERIFY_CHANNELS =
  process.env.VERIFY_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
export const BOT_CHANNELS =
  process.env.BOT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
export const VOICE_EVENT_CHANNELS =
  process.env.VOICE_EVENT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
export const JOIN_EVENT_CHANNELS =
  process.env.JOIN_EVENT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
export const MEMBERS_COUNT_CHANNELS =
  process.env.MEMBERS_COUNT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const MEMBERS_TEMPLATE = "members count";
export const STATS_TEMPLATE = "user stats";
export const TOP_STATS_TEMPLATE = "top stats";
export const COMMAND_HISTORY_TEMPLATE = "command history";
export const DELETED_MESSAGES_HISTORY_TEMPLATE = "deleted messages history";
export const VERIFY_TEMPLATE = "verify yourself";

export const RED_COLOR = parseInt("#FF0000") as number | undefined;
export const BOT_ICON =
  process.env.BOT_ICON?.trim() || "https://via.placeholder.com/32";

export const LEVEL_LIST = [
  { count: 10, role: ACTIVE },
  { count: 100, role: SUPER_ACTIVE },
  { count: 1000, role: MEGA_ACTIVE },
  { count: 2500, role: GIGA_ACTIVE },
  { count: 5000, role: ULTRA_ACTIVE },
];

export const LEVEL_MESSAGES = {
  [ACTIVE]: [
    "sys.log('New Intern Alert:'): ${user} has joined the development team as ${role}! First 10 commits merged successfully.",
    "console.debug('Onboarding Complete!'): ${user} has completed their initial training and earned ${role}!",
    "git log --author=${user}: First 10 contributions detected! Welcome to the team, ${role}!",
    "npm run first-promotion: ${user} has been promoted to Junior Developer ${role}!",
    "make intern-graduate: ${user} has completed their internship tasks and earned ${role}!",
  ],
  [SUPER_ACTIVE]: [
    "git status: ${user} completed their first code review cycle! Promoted to Junior Developer ${role}!",
    "npm run test: ${user} mastered unit testing and earned ${role}!",
    "console.log('First Bug Fix'): ${user} is debugging like a pro! Welcome to ${role}!",
    "git commit -m 'first-feature': ${user} shipped their first feature and earned ${role}!",
    "python debug.py: ${user} solved their first production bug! Awarded ${role}!",
  ],
  [MEGA_ACTIVE]: [
    "kubectl scale developer=${user}: Scaling up to Senior Developer ${role} after 1000 successful deployments!",
    "git shortlog -sn: ${user} is now a top contributor! Promoted to ${role}!",
    "aws promote-developer: ${user} architecting robust solutions as ${role}!",
    "terraform apply: ${user} infrastructure expertise recognized with ${role}!",
    "systemctl status ${user}: Senior level expertise confirmed, ${role} badge earned!",
  ],
  [GIGA_ACTIVE]: [
    "git blame reveals ${user} mentoring others! Promoted to Staff Engineer ${role}!",
    "helm upgrade --install expert-status: ${user} now leading architecture decisions as ${role}!",
    "metrics.measure('impact'): ${user} showing outstanding technical leadership as ${role}!",
    "graphql { developer { level: STAFF } }: ${user} promoted to ${role}!",
    "kubernetes apply -f staff-promotion: ${user} expertise scaled to ${role}!",
  ],
  [ULTRA_ACTIVE]: [
    "chmod 777 /company/architecture: ${user} granted Principal Engineer access as ${role}!",
    "SELECT * FROM legends Found ${user} with Distinguished Engineer status ${role}!",
    "git tag -a v.principal -m 'Technical Excellence': ${user} has achieved ${role}!",
    "sudo promote --level=principal: ${user} maxed out the tech ladder as ${role}!",
    "ansible-playbook promote-to-principal.yml: ${user} deployment complete as ${role}!",
  ],
};

export const DEV_BOARD_CHANNEL = "1300427846342283436";
export const JOB_BOARD_CHANNEL = "1300427561704226867";
