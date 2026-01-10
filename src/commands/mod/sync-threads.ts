import { PermissionFlagsBits, type GuildTextBasedChannel } from "discord.js";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";
import { syncAllThreads } from "../../lib/threads/sync-all-threads";

@Discord()
export class SyncThreads {
  @SimpleCommand({ aliases: ["sync-threads"], prefix: "!" })
  async syncThreads(command: SimpleCommandMessage) {
    const message = command.message;

    if (!message.guild) return;

    const member = await message.guild.members.fetch(message.author.id);
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply({
        content: "You don't have permission to use this command.",
      });
      return;
    }

    try {
      await syncAllThreads(
        message.guild,
        message.channel as GuildTextBasedChannel,
      );
    } catch (error) {
      console.error("Error in sync-threads command:", error);
    }
  }
}
