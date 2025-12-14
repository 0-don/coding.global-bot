import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

import { verifyAllUsers } from "../../lib/members/verify-all-users";

@Discord()
export class VerifyAllUsers {
  @SimpleCommand({ aliases: ["verify-all"], prefix: "!" })
  async verifyAllUsers(command: SimpleCommandMessage) {
    const message = command.message;

    if (!message.guild) return;

    // Check if user has manage roles permission
    const member = await message.guild.members.fetch(message.author.id);
    if (!member.permissions.has("ManageRoles")) {
      await message.reply({
        content: "You don't have permission to use this command.",
      });
      return;
    }

    try {
      await verifyAllUsers(message.guild, message.channel);
    } catch (error) {
      // Error handling is done in the verifyAllUsers function
      console.error("Error in verify-all command:", error);
    }
  }
}
