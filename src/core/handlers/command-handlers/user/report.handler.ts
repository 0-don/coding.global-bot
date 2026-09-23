import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { REPORT_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import type { MessageResult } from "@/types";
import type { CommandInteraction, TextChannel, User } from "discord.js";

const REPORT_COOLDOWN_MS = 60_000;

/**
 * A report posts an embed straight into a staff channel and needs no
 * permissions, so one annoyed member can bury the channel in seconds. Keyed per
 * guild, so cooling off in one server does not silence someone in another.
 */
const lastReportAt = new Map<string, number>();

function secondsLeftOfCooldown(key: string, now: number): number {
  const last = lastReportAt.get(key);
  if (last === undefined) return 0;

  const elapsed = now - last;
  if (elapsed >= REPORT_COOLDOWN_MS) return 0;

  return Math.ceil((REPORT_COOLDOWN_MS - elapsed) / 1000);
}

function pruneExpired(now: number): void {
  for (const [key, at] of lastReportAt) {
    if (now - at >= REPORT_COOLDOWN_MS) lastReportAt.delete(key);
  }
}

export async function executeReport(
  interaction: CommandInteraction,
  target: User,
  reason: string,
): Promise<MessageResult> {
  if (!interaction.guild) {
    return { error: "This command can only be used in a server" };
  }

  if (target.id === interaction.user.id) {
    return { error: "You can't report yourself" };
  }

  const now = Date.now();
  pruneExpired(now);

  const cooldownKey = `${interaction.guild.id}:${interaction.user.id}`;
  const waitSeconds = secondsLeftOfCooldown(cooldownKey, now);

  if (waitSeconds > 0) {
    return {
      error: `You're reporting too quickly. Try again in ${waitSeconds}s.`,
    };
  }

  if (!ConfigValidator.isFeatureEnabled("REPORT_CHANNELS")) {
    ConfigValidator.logFeatureDisabled("Member Reports", "REPORT_CHANNELS");
    return {
      error:
        "Reports aren't configured on this server yet. Please contact a mod directly.",
    };
  }

  const reportChannel = interaction.guild.channels.cache.find(({ name }) =>
    REPORT_CHANNELS.includes(name),
  );

  if (!reportChannel || !reportChannel.isTextBased()) {
    return {
      error:
        "Couldn't find the configured report channel. Please contact a mod directly.",
    };
  }

  const reportEmbed = simpleEmbedExample();
  reportEmbed.description =
    `**Reported user:** ${target} (${target.username})\n` +
    `**Reported by:** ${interaction.member} (${interaction.member?.user.username})\n\n` +
    `**Reason:**\n${reason}`;
  reportEmbed.footer!.text = "report";

  try {
    await (reportChannel as TextChannel).send({
      embeds: [reportEmbed],
      allowedMentions: { users: [], roles: [] },
    });
  } catch {
    // Cooldown is recorded only past this point, so a report that never
    // reached the channel does not cost the member their next minute.
    return {
      error: "Failed to submit the report. Please contact a mod directly.",
    };
  }

  lastReportAt.set(cooldownKey, now);

  return { message: "Your report has been submitted to the moderators." };
}
