import {
  COPY_PASTER,
  INTERN,
  JUNIOR_DEV,
  LEAD_DEV,
  MID_DEV,
  SCRIPT_KIDDIE,
  SENIOR_DEV,
  TECH_LEAD,
  VIBE_CODER,
} from "./roles";

// Level thresholds and role mappings
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

// Level-up messages for each role
export const LEVEL_MESSAGES: Record<string, string[]> = {
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
