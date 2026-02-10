import { BOT_OWNER_ID } from "@/shared/config/roles";
import type { CommandInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

const ELEVATED_PERMISSIONS = [
  { flag: PermissionFlagsBits.Administrator, name: "Administrator" },
  { flag: PermissionFlagsBits.BanMembers, name: "Ban Members" },
  { flag: PermissionFlagsBits.KickMembers, name: "Kick Members" },
  { flag: PermissionFlagsBits.ManageGuild, name: "Manage Server" },
  { flag: PermissionFlagsBits.ManageChannels, name: "Manage Channels" },
  { flag: PermissionFlagsBits.ManageRoles, name: "Manage Roles" },
  { flag: PermissionFlagsBits.ManageMessages, name: "Manage Messages" },
  { flag: PermissionFlagsBits.ManageWebhooks, name: "Manage Webhooks" },
  { flag: PermissionFlagsBits.ManageNicknames, name: "Manage Nicknames" },
  { flag: PermissionFlagsBits.ManageEvents, name: "Manage Events" },
  { flag: PermissionFlagsBits.ManageThreads, name: "Manage Threads" },
  {
    flag: PermissionFlagsBits.ManageGuildExpressions,
    name: "Manage Expressions",
  },
  { flag: PermissionFlagsBits.MentionEveryone, name: "Mention Everyone" },
  { flag: PermissionFlagsBits.ModerateMembers, name: "Timeout Members" },
  { flag: PermissionFlagsBits.MuteMembers, name: "Mute Members" },
  { flag: PermissionFlagsBits.DeafenMembers, name: "Deafen Members" },
  { flag: PermissionFlagsBits.MoveMembers, name: "Move Members" },
  { flag: PermissionFlagsBits.ViewAuditLog, name: "View Audit Log" },
  {
    flag: PermissionFlagsBits.ViewCreatorMonetizationAnalytics,
    name: "View Monetization",
  },
  { flag: PermissionFlagsBits.CreateInstantInvite, name: "Create Invite" },
];

export async function executeAuditRoles(
  interaction: CommandInteraction,
): Promise<string> {
  if (interaction.user.id !== BOT_OWNER_ID) {
    return "This command is restricted to the bot owner.";
  }

  const guild = interaction.guild;
  if (!guild) {
    return "This command can only be used in a server.";
  }

  const roles = guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .filter((r) => r.id !== guild.id); // exclude @everyone

  const findings: string[] = [];

  for (const [, role] of roles) {
    const elevated = ELEVATED_PERMISSIONS.filter((p) =>
      role.permissions.has(p.flag),
    );

    if (elevated.length === 0) continue;

    const permNames = elevated.map((p) => p.name).join(", ");
    findings.push(
      `**${role.name}** (${role.members.size} members): ${permNames}`,
    );
  }

  if (findings.length === 0) {
    return "No roles with elevated permissions found.";
  }

  const header = `**Role Permission Audit** — ${findings.length} roles with elevated permissions:\n\n`;
  const body = findings.join("\n");
  const full = header + body;

  // Discord message limit is 2000 chars, split if needed
  if (full.length <= 2000) {
    return full;
  }

  const chunks: string[] = [header];
  let current = "";
  for (const line of findings) {
    if ((current + "\n" + line).length > 1900) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);

  // Return first chunk with a note; the command will handle follow-ups
  return chunks.join("\n---\n");
}
