import { type GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";
import { verifyAllUsers } from "@/core/services/members/verify-all-users";

@Discord()
export class VerifyAllUsers {
  @SimpleCommand({ aliases: ["verify-all"], prefix: "!" })
  async verifyAllUsers(command: SimpleCommandMessage) {
    const message = command.message;

    if (!message.guild) return;

    const member = await message.guild.members.fetch(message.author.id);
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await message.reply({
        content: "You don't have permission to use this command.",
      });
      return;
    }

    try {
      await verifyAllUsers(message.guild, message.channel as GuildTextBasedChannel);
    } catch (error) {
      console.error("Error in verify-all command:", error);
    }
  }
}
