import { executeSyncThreads } from "@/core/handlers/command-handlers/mod/sync-threads.handler";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

@Discord()
export class SyncThreads {
  @SimpleCommand({ aliases: ["sync-threads"], prefix: "!" })
  async syncThreads(command: SimpleCommandMessage) {
    const result = await executeSyncThreads(command);

    if (result.error) {
      await command.message.reply({ content: result.error });
    }
  }
}
