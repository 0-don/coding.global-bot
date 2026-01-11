import { executeVerifyAllUsers } from "@/core/handlers/command-handlers/mod/verify-all-users.handler";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

@Discord()
export class VerifyAllUsers {
  @SimpleCommand({ aliases: ["verify-all"], prefix: "!" })
  async verifyAllUsers(command: SimpleCommandMessage) {
    const result = await executeVerifyAllUsers(command);

    if (result.error) {
      await command.message.reply({ content: result.error });
    }
  }
}
