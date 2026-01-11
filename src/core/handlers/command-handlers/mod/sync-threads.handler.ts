import { syncAllThreads } from "@/core/services/threads/sync-all-threads";
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
    await syncAllThreads(
      message.guild,
      message.channel as GuildTextBasedChannel,
    );
    return { success: true };
  } catch (error) {
    console.error("Error in sync-threads command:", error);
    return { success: false };
  }
}
