import { executeMigrateThreadUrls } from "@/core/handlers/command-handlers/mod/migrate-thread-urls.handler";
import type { SimpleCommandMessage } from "discordx";
import { Discord, SimpleCommand } from "discordx";

@Discord()
export class MigrateThreadUrls {
  @SimpleCommand({ aliases: ["migrate-thread-urls"], prefix: "!" })
  async migrateThreadUrls(command: SimpleCommandMessage) {
    const result = await executeMigrateThreadUrls(command);

    if (result.error) {
      await command.message.reply({ content: result.error });
    }
  }
}
