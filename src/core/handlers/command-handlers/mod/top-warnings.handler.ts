import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { WarningsService } from "@/core/services/moderation/warnings.service";
import type { EmbedResult } from "@/types";
import type { CommandInteraction } from "discord.js";

export async function executeTopWarnings(
  interaction: CommandInteraction,
  page: number,
): Promise<EmbedResult> {
  if (!interaction.guild) {
    return { error: "This command can only be used in a server" };
  }

  const { rows, pageSize } = await WarningsService.getTopWarnings(
    interaction.guild.id,
    Math.max(0, page - 1),
  );

  if (rows.length === 0) {
    return { error: "No warnings have been issued in this server yet." };
  }

  const embed = simpleEmbedExample();
  const rankOffset = (Math.max(1, page) - 1) * pageSize;
  embed.description = rows
    .map(
      (r, i) =>
        `**${rankOffset + i + 1}.** ${r.username} - ${r.warningCount} warning${r.warningCount === 1 ? "" : "s"}`,
    )
    .join("\n");
  embed.footer!.text = `Most warned members • page ${page}`;

  return { embed };
}
