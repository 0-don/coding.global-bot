import { error, log } from "console";
import dayjs from "dayjs";
import { Collection, Guild, GuildMember, type GuildTextBasedChannel } from "discord.js";
import { prisma } from "../../prisma";
import { STATUS_ROLES, VERIFIED } from "../constants";
import { RolesService } from "../roles/roles.service";
import { updateCompleteMemberData } from "./member-data.service";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 30000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const logTs = (level: "info" | "error" | "warn", guild: string, msg: string) => {
  const ts = dayjs().format("HH:mm:ss.SSS");
  const fn = level === "error" ? error : log;
  fn(`[${ts}] [${level.toUpperCase()}] [${guild}] ${msg}`);
};

async function withRetry<T>(fn: () => Promise<T>, label: string, guild: string): Promise<T> {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout")), TIMEOUT_MS)),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTs("warn", guild, `${label} failed (${i}/${MAX_RETRIES}): ${msg}`);
      if (i === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY_MS * i);
    }
  }
  throw new Error("Unreachable");
}

const runningGuilds = new Set<string>();

export function isVerificationRunning(guildId: string): boolean {
  return runningGuilds.has(guildId);
}

export async function verifyAllUsers(
  guild: Guild,
  channel: GuildTextBasedChannel,
): Promise<Collection<string, GuildMember> | undefined> {
  const guildName = guild.name.slice(0, 20);

  if (runningGuilds.has(guild.id)) {
    await channel.send("Verification already running.");
    return;
  }

  runningGuilds.add(guild.id);

  try {
    await prisma.guild.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, guildName: guild.name },
      update: { guildName: guild.name },
    });

    const statusRoles = RolesService.getGuildStatusRoles(guild);
    if (STATUS_ROLES.some((r) => !statusRoles[r])) {
      const missing = STATUS_ROLES.filter((r) => !statusRoles[r]).join(", ");
      await channel.send(`Missing roles: ${missing}`);
      return;
    }

    logTs("info", guildName, "Fetching members...");
    const allMembers = await withRetry(() => guild.members.fetch(), "Fetch members", guildName);
    const members = Array.from(allMembers.values())
      .filter((m) => !m.user.bot)
      .sort((a, b) => a.id.localeCompare(b.id));

    // Load saved progress - track by member ID, not index
    const saved = await prisma.verificationProgress.findUnique({ where: { guildId: guild.id } });
    const processedIds = new Set(saved?.processedIds ?? []);
    const failedIds = new Set(saved?.failedIds ?? []);

    // Filter out already processed members
    const remaining = members.filter((m) => !processedIds.has(m.id));
    const total = members.length;
    const alreadyDone = processedIds.size;

    const resumeMsg = alreadyDone > 0 ? ` (resuming: ${alreadyDone}/${total} done)` : "";
    logTs("info", guildName, `Processing ${remaining.length} members${resumeMsg}`);
    const progressMsg = await channel.send(`Processing ${total} members${resumeMsg}...`);

    for (let i = 0; i < remaining.length; i++) {
      const member = remaining[i];
      const tag = `${member.user.username} (${member.id})`;

      try {
        await withRetry(async () => {
          await updateCompleteMemberData(member);
          if (statusRoles[VERIFIED]) {
            const roleId = statusRoles[VERIFIED]!.id;
            if (!member.roles.cache.has(roleId)) {
              const role = guild.roles.cache.get(roleId);
              if (role?.editable) await member.roles.add(roleId);
            }
          }
        }, `Process ${tag}`, guildName);
        processedIds.add(member.id);
        logTs("info", guildName, `✓ ${tag} (${alreadyDone + i + 1}/${total})`);
      } catch {
        failedIds.add(member.id);
        logTs("error", guildName, `✗ ${tag} (${alreadyDone + i + 1}/${total})`);
      }

      const done = alreadyDone + i + 1;

      await prisma.verificationProgress.upsert({
        where: { guildId: guild.id },
        create: { guildId: guild.id, processedIds: [...processedIds], failedIds: [...failedIds] },
        update: { processedIds: [...processedIds], failedIds: [...failedIds] },
      });

      // Update Discord message
      if ((i + 1) % 25 === 0 || i + 1 === remaining.length) {
        const pct = Math.round((done / total) * 100);
        await progressMsg.edit(`Verifying: ${done}/${total} (${pct}%)`).catch(() => {});
      }
    }

    // Clear progress on completion
    await prisma.verificationProgress.delete({ where: { guildId: guild.id } }).catch(() => {});

    const result = failedIds.size > 0
      ? `Done! Processed ${total} members (${failedIds.size} failed)`
      : `Done! Processed ${total} members`;
    await progressMsg.edit(result).catch(() => {});
    logTs("info", guildName, result);

    return allMembers;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logTs("error", guildName, `Verification failed: ${msg}`);
    await channel.send(`Error: ${msg}. Run again to resume.`);
    throw err;
  } finally {
    runningGuilds.delete(guild.id);
  }
}
