import { ThreadService } from "@/core/services/threads/thread.service";
import { log } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class ThreadDelete {
  @On({ event: "threadDelete" })
  async threadDelete([thread]: ArgsOf<"threadDelete">, client: Client) {
    // Delete thread from database (cascade deletes replies)
    log("Thread deleted:", thread.id, thread.name, thread.parent?.name);
    await ThreadService.deleteThread(thread.id);
  }
}
