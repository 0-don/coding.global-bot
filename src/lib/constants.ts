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

export const JUNIOR_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "junior dev!") ||
  LEVEL_ROLES?.[0];
export const MID_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "mid dev!") || LEVEL_ROLES?.[1];
export const SENIOR_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "senior dev!") ||
  LEVEL_ROLES?.[2];
export const LEAD_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "lead dev!") || LEVEL_ROLES?.[3];
export const PRINCIPAL_DEV =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "principal dev!") ||
  LEVEL_ROLES?.[4];
export const STAFF_ENGINEER =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "staff engineer!") ||
  LEVEL_ROLES?.[5];
export const TECH_LEAD =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "tech lead!") || LEVEL_ROLES?.[6];
export const ENGINEERING_MANAGER =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "engineering manager!") ||
  LEVEL_ROLES?.[7];
export const CTO =
  LEVEL_ROLES.find((r) => r.toLowerCase() === "cto!") || LEVEL_ROLES?.[8];

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
  { count: 10, role: JUNIOR_DEV },
  { count: 100, role: MID_DEV },
  { count: 500, role: SENIOR_DEV },
  { count: 1500, role: LEAD_DEV },
  { count: 3500, role: PRINCIPAL_DEV },
  { count: 7500, role: STAFF_ENGINEER },
  { count: 15000, role: TECH_LEAD },
  { count: 25000, role: ENGINEERING_MANAGER },
  { count: 40000, role: CTO },
];

export const LEVEL_MESSAGES = {
  [JUNIOR_DEV]: [
    "git init career; // ${user} started their journey as ${role}!",
    "console.log('Hello World, I am ${user}!'); // First steps as ${role}!",
    "npm install confidence; // ${user} building skills as ${role}!",
    "if (dedication === true) { promote('${user}', '${role}'); }",
    "// TODO: Learn everything - ${user} (${role})",
  ],
  [MID_DEV]: [
    "git commit -m 'Fixed my first major bug' --author='${user} (${role})'",
    "const experience = await learn(); // ${user} leveled up to ${role}!",
    "docker run confidence:latest ${user} // ${role} container ready!",
    "while(learning) { ${user}.grow(); } // Continuous improvement as ${role}!",
    "merge pull-request #${user} into main // ${role} contributing quality code!",
  ],
  [SENIOR_DEV]: [
    "class ${user} extends Developer { role = '${role}'; expertise = 'high'; }",
    "// Code review approved by ${user} (${role}) - Ship it!",
    "kubectl scale developer ${user} --replicas=senior // ${role} promotion!",
    "SELECT * FROM team WHERE mentor = '${user}' AND role = '${role}';",
    "terraform apply -var='tech_lead=${user}' // ${role} infrastructure expertise!",
  ],
  [LEAD_DEV]: [
    "git branch feature/team-leadership-${user} // ${role} taking charge!",
    "const team = new Team({ lead: '${user}', role: '${role}' });",
    "// Architecture decisions now made by ${user} (${role})",
    "docker-compose up team-success // Orchestrated by ${role} ${user}!",
    "scrum.addLeader('${user}'); // ${role} guiding the team forward!",
  ],
  [PRINCIPAL_DEV]: [
    "import wisdom from '${user}'; // ${role} sharing deep knowledge!",
    "// System design by ${user} - ${role} level architecture",
    "git tag v1.0-designed-by-${user} // ${role} milestone achievement!",
    "const innovation = ${user}.think(); // ${role} driving technical vision!",
    "sudo make ${user} principal // ${role} status: GRANTED!",
  ],
  [STAFF_ENGINEER]: [
    "package.json: { 'technical-excellence': '${user}@${role}' }",
    "// Cross-team impact delivered by ${user} (${role})",
    "helm upgrade company-tech --set leader=${user} // ${role} influence!",
    "query: SELECT impact FROM engineering WHERE staff = '${user}' (${role});",
    "microservices.all().acknowledge('${user}', '${role}');",
  ],
  [TECH_LEAD]: [
    "git config --global tech.leader '${user}' // ${role} global impact!",
    "// Strategic technical decisions by ${user} (${role})",
    "kubernetes apply -f tech-strategy-${user}.yaml // ${role} vision deployed!",
    "const future = await ${user}.architect(); // ${role} shaping tomorrow!",
    "echo '${user} (${role})' >> /etc/tech-leaders.conf",
  ],
  [ENGINEERING_MANAGER]: [
    "class Team { constructor(manager = '${user}') { this.success = true; } } // ${role}!",
    "// People + Technology = Success. Formula by ${user} (${role})",
    "docker run --name team-growth ${user}:${role} // Leadership container!",
    "SELECT * FROM career_growth WHERE manager = '${user}' AND role = '${role}';",
    "terraform plan -var='team_lead=${user}' // ${role} building futures!",
  ],
  [CTO]: [
    "#!/bin/bash\n# Company technical vision by ${user}\necho '${role} level: MAXIMUM'",
    "const company = new Enterprise({ cto: '${user}' }); // ${role} at the helm!",
    "git commit -m 'Transformed entire tech stack' --author='${user} (${role})'",
    "SELECT innovation FROM company WHERE cto = '${user}' AND role = '${role}';",
    "sudo systemctl enable future.service // ${role} ${user} driving innovation!",
  ],
};
