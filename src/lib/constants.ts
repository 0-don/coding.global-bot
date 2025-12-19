import { createCanvas } from "canvas";
import { Chart } from "chart.js";
import * as deepl from "deepl-node";
import { ConfigValidator } from "./config-validator";

export const GLOBAL_CANVAS = createCanvas(1200, 400);
export const CHARTJS_NODE_CANVAS = GLOBAL_CANVAS.getContext("2d");
export const TRANSLATOR = ConfigValidator.isFeatureEnabled("DEEPL")
  ? new deepl.Translator(process.env.DEEPL!)
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

export const COPY_PASTER =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "copy paster!") ||
  LEVEL_ROLES?.[0];
export const SCRIPT_KIDDIE =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "script kiddie!") ||
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
  { count: 10, role: COPY_PASTER },
  { count: 100, role: SCRIPT_KIDDIE },
  { count: 500, role: VIBE_CODER },
  { count: 1000, role: INTERN },
  { count: 2500, role: JUNIOR_DEV },
  { count: 5000, role: MID_DEV },
  { count: 10000, role: SENIOR_DEV },
  { count: 25000, role: LEAD_DEV },
  { count: 50000, role: TECH_LEAD },
];

export const LEVEL_MESSAGES = {
  [COPY_PASTER]: [
    "// Copied from Stack Overflow by ${user} (${role})",
    "Ctrl+C, Ctrl+V; // ${user} mastering the basics as ${role}!",
    "const code = copyPaste('stackoverflow'); // ${user} learning as ${role}!",
    "// It works! Don't ask me how - ${user} (${role})",
    "git commit -m 'Added code (not sure what it does)' --author='${user} (${role})'",
  ],
  [SCRIPT_KIDDIE]: [
    "./run.sh; // ${user} executing scripts as ${role}!",
    "python script.py --help; // ${user} exploring tools as ${role}!",
    "// Found this cool script online - ${user} (${role})",
    "chmod +x everything.sh; ${user} // ${role} getting dangerous!",
    "curl -sSL install.sh | bash; // ${user} living on the edge as ${role}!",
  ],
  [VIBE_CODER]: [
    "print('Just vibing and coding!'); // ${user} joined as ${role}! ✨",
    "const vibe = 'immaculate'; // ${user} bringing the energy as ${role}!",
    "// Just here for the good vibes and code - ${user} (${role})",
    "npm install good-vibes; // ${user} setting the mood as ${role}!",
    "git commit -m 'Adding some vibe to the codebase' --author='${user} (${role})'",
  ],
  [INTERN]: [
    "git init career; // ${user} started their internship as ${role}!",
    "print('Hello World, I am ${user} the ${role}!'); // First day excitement!",
    "npm install --save enthusiasm; // ${user} joining as ${role}!",
    "// Day 1: Everything is awesome! - ${user} (${role})",
    "const firstDay = new Experience('${user}', '${role}'); // Journey begins!",
  ],
  [JUNIOR_DEV]: [
    "git commit -m 'Graduated from internship' --author='${user} (${role})'",
    "const confidence = await learn(); // ${user} growing as ${role}!",
    "if (hardWork === true) { promote('${user}', '${role}'); }",
    "// TODO: Master the fundamentals - ${user} (${role})",
    "docker run learning:latest ${user} // ${role} development environment!",
  ],
  [MID_DEV]: [
    "git commit -m 'Fixed my first major bug' --author='${user} (${role})'",
    "const experience = await practice(); // ${user} leveled up to ${role}!",
    "while(coding) { ${user}.improve(); } // Continuous growth as ${role}!",
    "merge pull-request #${user} into main // ${role} contributing quality code!",
    "// Code review skills unlocked by ${user} (${role})",
  ],
  [SENIOR_DEV]: [
    "class ${user} extends Developer { role = '${role}'; expertise = 'high'; }",
    "// Code review approved by ${user} (${role}) - Ship it!",
    "kubectl scale developer ${user} --replicas=senior // ${role} promotion!",
    "SELECT * FROM team WHERE mentor = '${user}' AND role = '${role}';",
    "terraform apply -var='senior_dev=${user}' // ${role} infrastructure expertise!",
  ],
  [LEAD_DEV]: [
    "git branch feature/team-leadership-${user} // ${role} taking charge!",
    "const team = new Team({ lead: '${user}', role: '${role}' });",
    "// Architecture decisions now made by ${user} (${role})",
    "docker-compose up team-success // Orchestrated by ${role} ${user}!",
    "scrum.addLeader('${user}'); // ${role} guiding the team forward!",
  ],
  [TECH_LEAD]: [
    "git config --global tech.leader '${user}' // ${role} global impact!",
    "// Strategic technical decisions by ${user} (${role})",
    "kubernetes apply -f tech-strategy-${user}.yaml // ${role} vision deployed!",
    "const future = await ${user}.architect(); // ${role} shaping tomorrow!",
    "echo '${user} (${role})' >> /etc/tech-leaders.conf",
  ],
};
