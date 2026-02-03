import { Discord, SimpleCommand, SimpleCommandMessage } from "discordx";
import { PermissionFlagsBits } from "discord.js";
import { SwapLevelRolesHandler } from "../../../core/handlers/command-handlers/mod/swap-level-roles.handler";

@Discord()
export class SwapLevelRolesCommand {
  @SimpleCommand({
    name: "swap-level-roles",
    aliases: ["swap-roles"],
    prefix: "!",
  })
  async swapLevelRoles(command: SimpleCommandMessage) {
    if (!command.message.guild) return;
    if (!command.message.member) return;

    // Check if user has manage roles permission
    const member = command.message.member;
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await command.message.reply(
        "❌ You need Manage Roles permission to use this command."
      );
      return;
    }

    await SwapLevelRolesHandler.execute(command.message);
  }
}
