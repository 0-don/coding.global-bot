import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { handleAiChatMessage } from "@/core/handlers/event-handlers/ai-chat.handler";

@Discord()
export class AiChat {
  @On()
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client,
  ): Promise<void> {
    await handleAiChatMessage(message, client);
  }
}
