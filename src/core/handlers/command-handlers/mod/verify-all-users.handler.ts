import { GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { SimpleCommandMessage } from "discordx";
import { verifyAllUsers } from "@/core/services/members/verify-all-users";
import type { CommandResult } from "@/types";

export async function executeVerifyAllUsers(
  command: SimpleCommandMessage,
): Promise<CommandResult> {
  const message = command.message;
  if (!message.guild) return { success: false, error: "Use in a server" };

  const member = await message.guild.members.fetch(message.author.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return {
      success: false,
      error: "You don't have permission to use this command.",
    };
  }

  try {
    await verifyAllUsers(
      message.guild,
      message.channel as GuildTextBasedChannel,
    );
    return { success: true };
  } catch (error) {
    console.error("Error in verify-all command:", error);
    return { success: false };
  }
}
