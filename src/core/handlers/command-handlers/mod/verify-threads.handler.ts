import { SyncAllThreadsService } from "@/core/services/threads/verify-threads.service";
import { botLogger } from "@/lib/telemetry";
import type { CommandResult } from "@/types";
import { GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { SimpleCommandMessage } from "discordx";

export async function executeSyncThreads(
  command: SimpleCommandMessage,
): Promise<CommandResult> {
  const message = command.message;
  if (!message.guild) return { success: false, error: "Use in a server" };

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return {
      success: false,
      error: "You don't have permission to use this command.",
    };
  }

  try {
    await SyncAllThreadsService.syncAllThreads(
      message.guild,
      message.channel as GuildTextBasedChannel,
    );
    return { success: true };
  } catch (error) {
    botLogger.error("Error in sync-threads command", { error: String(error) });
    return { success: false };
  }
}
