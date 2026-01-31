import { VerifyAllUsersService } from "@/core/services/members/verify-users.service";
import { botLogger } from "@/lib/telemetry";
import type { CommandResult } from "@/types";
import { GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { SimpleCommandMessage } from "discordx";

export async function executeVerifyAllUsers(
  command: SimpleCommandMessage,
): Promise<CommandResult> {
  const message = command.message;
  botLogger.info("Command message received", { content: message.content });
  if (!message.guild) return { success: false, error: "Use in a server" };

  botLogger.debug("Checking permissions", { user: message.author.tag });
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return {
      success: false,
      error: "You don't have permission to use this command.",
    };
  }

  try {
    await VerifyAllUsersService.verifyAllUsers(
      message.guild,
      message.channel as GuildTextBasedChannel,
    );
    return { success: true };
  } catch (error) {
    botLogger.error("Error in verify-all command", { error: String(error) });
    return { success: false };
  }
}
