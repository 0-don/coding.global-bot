import { SwapLevelRolesService } from "@/core/services/roles/swap-level-roles.service";
import { botLogger } from "@/lib/telemetry";
import type { Message } from "discord.js";
import { GuildTextBasedChannel } from "discord.js";

export class SwapLevelRolesHandler {
  static async execute(message: Message): Promise<void> {
    botLogger.info("Swap level roles command received", {
      content: message.content,
      author: message.author.tag,
    });

    if (!message.guild) {
      await message.reply("❌ This command can only be used in a server.");
      return;
    }

    if (SwapLevelRolesService.isSwapRunning(message.guild.id)) {
      await message.reply("❌ Role swap is already running. Please wait...");
      return;
    }

    try {
      await SwapLevelRolesService.swapLevelRoles(
        message.guild,
        message.channel as GuildTextBasedChannel
      );
    } catch (error) {
      botLogger.error("Error in swap-level-roles command", {
        error: String(error),
      });
      await message.reply(
        "❌ An error occurred during role swap. Check logs for details."
      );
    }
  }
}
