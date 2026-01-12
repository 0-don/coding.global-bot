import { executeVerifyAllUsers } from "@/core/handlers/command-handlers/mod/verify-users.handler";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

@Discord()
export class VerifyUsers {
  @SimpleCommand({ aliases: ["verify-users"], prefix: "!" })
  async verifyUsers(command: SimpleCommandMessage) {
    const result = await executeVerifyAllUsers(command);

    if (result.error) {
      await command.message.reply({ content: result.error });
    }
  }
}
