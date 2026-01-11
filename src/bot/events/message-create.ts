import type { ArgsOf, Client, SimpleCommandMessage } from "discordx";
import { Discord, On, SimpleCommand } from "discordx";
import {
  handleCheckThreadHelpLike,
  handleMessageCreate,
  handleTranslateReply,
} from "@/core/handlers/event-handlers/message-create.handler";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client,
  ): Promise<void> {
    await handleMessageCreate(message);
  }

  @SimpleCommand({ aliases: [""], prefix: ["✅", ":white_check_mark:"] })
  async checkThreadHelpLike(command: SimpleCommandMessage) {
    await handleCheckThreadHelpLike(command);
  }

  @SimpleCommand({ aliases: ["translate", "explain", "slate"], prefix: "/" })
  async translateReply(command: SimpleCommandMessage) {
    await handleTranslateReply(command);
  }
}
