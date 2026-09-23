import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { fromDbTimestamp } from "@/shared/utils/date.utils";
import { WarningsService } from "@/core/services/moderation/warnings.service";
import type { EmbedResult } from "@/types";
import { PermissionFlagsBits } from "discord.js";
import type { CommandInteraction, User } from "discord.js";

export async function executeWarnings(
  interaction: CommandInteraction,
  user: User | undefined,
  page: number,
): Promise<EmbedResult> {
  if (!interaction.guild) {
    return { error: "This command can only be used in a server" };
  }

  const target = user ?? interaction.user;
  const isSelf = target.id === interaction.user.id;

  // Production rendered this footer as "undefined - 1 warning - page 1/1", so
  // the resolved option reached here without a username while still carrying a
  // usable id - the lookup itself returned the right member's warnings. The
  // cause is not visible from the option declaration, which matches /warn's
  // exactly, so the name is taken from whichever source actually has it rather
  // than trusting one.
  const targetName =
    target.username ||
    interaction.guild.members.cache.get(target.id)?.user.username ||
    "Unknown member";

  // The command carries no defaultMemberPermissions so members can reach their
  // own record, which means reading anyone else's has to be gated here.
  if (
    !isSelf &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)
  ) {
    return { error: "You can only look up your own warnings" };
  }

  const { warnings, total, totalPages } = await WarningsService.getWarnings(
    interaction.guild.id,
    target.id,
    Math.max(0, page - 1),
  );

  if (total === 0) {
    return {
      error: isSelf
        ? "You have no warnings."
        : `${targetName} has no warnings.`,
    };
  }

  const embed = simpleEmbedExample();

  // Labelled "ID", not "#". /delete-warning and /edit-warning both ask for a
  // warning ID and point at this list to find it, and "#1" reads as the first
  // row rather than as the number to type - which is exactly how it was read.
  // The value is the same either way; only the label was ambiguous.
  embed.description = warnings
    .map(
      (w) =>
        `**ID \`${w.id}\`** — ${w.reason}\n` +
        `by ${w.moderator?.username ?? "automod"} • <t:${Math.floor((fromDbTimestamp(w.createdAt)?.getTime() ?? Date.now()) / 1000)}:R>`,
    )
    .join("\n\n");

  // Only a moderator can act on these, so only they are told how.
  if (!isSelf)
    embed.description += `\n\n-# Use \`/delete-warning\` or \`/edit-warning\` with the ID above.`;
  embed.footer!.text = `${targetName} • ${total} warning${total === 1 ? "" : "s"} • page ${Math.max(1, page)}/${totalPages}`;

  return { embed };
}
