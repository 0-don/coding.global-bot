import { handleThreadCreate } from "@/core/handlers/event-handlers/thread-create.handler";
import { log } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class ThreadCreate {
  @On({ event: "threadCreate" })
  async threadCreate(
    [thread, newlyCreated]: ArgsOf<"threadCreate">,
    client: Client,
  ) {
    log(
      "Thread created:",
      thread.id,
      thread.name,
      newlyCreated,
      thread.parent?.name,
    );
    await handleThreadCreate(thread, newlyCreated);
  }
}
