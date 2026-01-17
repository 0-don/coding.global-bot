import { VerifyAllUsersService } from "@/core/services/members/verify-users.service";
import type { CommandResult } from "@/types";
import { GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { SimpleCommandMessage } from "discordx";

export async function executeVerifyAllUsers(
  command: SimpleCommandMessage,
): Promise<CommandResult> {
  const message = command.message;
  console.log("Command message received:", message.content);
  if (!message.guild) return { success: false, error: "Use in a server" };

  console.log("Checking permissions for user:", message.author.tag);
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
    console.error("Error in verify-all command:", error);
    return { success: false };
  }
}
