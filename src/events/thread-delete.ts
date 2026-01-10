import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ThreadService } from "../lib/threads/thread.service";

@Discord()
export class ThreadDelete {
  @On({ event: "threadDelete" })
  async threadDelete([thread]: ArgsOf<"threadDelete">, client: Client) {
    // Delete thread from database (cascade deletes replies)
    await ThreadService.deleteThread(thread.id);
  }
}
