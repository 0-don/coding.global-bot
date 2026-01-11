import { executeSyncThreads as executeVerifyThreads } from "@/core/handlers/command-handlers/mod/sync-threads.handler";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

@Discord()
export class VerifyThreads {
  @SimpleCommand({ aliases: ["verify-threads"], prefix: "!" })
  async verifyThreads(command: SimpleCommandMessage) {
    const result = await executeVerifyThreads(command);

    if (result.error) {
      await command.message.reply({ content: result.error });
    }
  }
}
