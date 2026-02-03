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
  { count: 10, role: SCRIPT_KIDDIE },
  { count: 100, role: COPY_PASTER },
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
    "`// Copied from Stack Overflow by` ${user} **${role}**",
    "`Ctrl+C, Ctrl+V;` ${user} mastering the basics as **${role}**!",
    "`copyPaste('stackoverflow')` // ${user} learning as **${role}**!",
    "`// It works! Don't ask me how` - ${user} **${role}**",
    "`git commit -m 'Added code'` by ${user} **${role}**",
  ],
  [SCRIPT_KIDDIE]: [
    "`./run.sh` executed by ${user} **${role}**!",
    "`python script.py` // ${user} exploring tools as **${role}**!",
    "`// Found this cool script online` - ${user} **${role}**",
    "`chmod +x everything.sh` ${user} **${role}** getting dangerous!",
    "`bash install.sh` // ${user} living on the edge as **${role}**!",
  ],
  [VIBE_CODER]: [
    "`print('Just vibing!')` ${user} joined as **${role}**!",
    "`const vibe = 'immaculate'` // ${user} bringing energy as **${role}**!",
    "`// Good vibes and code` - ${user} **${role}**",
    "`npm install good-vibes` // ${user} setting the mood as **${role}**!",
    "`git commit -m 'Adding vibes'` by ${user} **${role}**",
  ],
  [INTERN]: [
    "`git init career` // ${user} started as **${role}**!",
    "`print('Hello World!')` ${user} the **${role}**! First day!",
    "`npm install enthusiasm` // ${user} joining as **${role}**!",
    "`// Day 1: Everything is awesome!` - ${user} **${role}**",
    "`new Experience()` // ${user} **${role}** journey begins!",
  ],
  [JUNIOR_DEV]: [
    "`git commit -m 'Graduated'` by ${user} **${role}**",
    "`await learn()` // ${user} growing as **${role}**!",
    "`if (hardWork) { promote() }` ${user} **${role}**",
    "`// TODO: Master fundamentals` - ${user} **${role}**",
    "`docker run learning:latest` ${user} **${role}** environment!",
  ],
  [MID_DEV]: [
    "`git commit -m 'Fixed major bug'` by ${user} **${role}**",
    "`await practice()` // ${user} leveled up to **${role}**!",
    "`while(coding) { improve() }` ${user} **${role}**!",
    "`merge pull-request` by ${user} **${role}** quality code!",
    "`// Code review skills unlocked` ${user} **${role}**",
  ],
  [SENIOR_DEV]: [
    "`class Developer { expertise = 'high' }` ${user} **${role}**",
    "`// Code review approved` by ${user} **${role}** - Ship it!",
    "`kubectl scale replicas=senior` ${user} **${role}** promotion!",
    "`SELECT expertise FROM team` mentor: ${user} **${role}**",
    "`terraform apply` // ${user} **${role}** infrastructure expertise!",
  ],
  [LEAD_DEV]: [
    "`git branch feature/leadership` ${user} **${role}** taking charge!",
    "`new Team({ lead })` ${user} **${role}**",
    "`// Architecture decisions` now made by ${user} **${role}**",
    "`docker-compose up` Orchestrated by ${user} **${role}**!",
    "`scrum.addLeader()` ${user} **${role}** guiding the team!",
  ],
  [TECH_LEAD]: [
    "`git config tech.leader` ${user} **${role}** global impact!",
    "`// Strategic technical decisions` by ${user} **${role}**",
    "`kubernetes apply strategy.yaml` ${user} **${role}** vision deployed!",
    "`await architect()` ${user} **${role}** shaping tomorrow!",
    "`echo to /etc/leaders.conf` ${user} **${role}**",
  ],
};
