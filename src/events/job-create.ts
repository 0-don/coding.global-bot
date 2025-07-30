import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { JOB_POST_REGEX } from "../lib/helpers";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async onMessage([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.channelId !== DEV_BOARD_CHANNEL) return;
    if (message.author.bot) return;

    if (!JOB_POST_REGEX.test(message.content)) {
      await message.delete();

      try {
        await message.author.send({
          content: `Your post in the job board was deleted because it didn't follow the required format`,
        });
      } catch {
        console.log(`Couldn't send DM to ${message.author.tag}`);
      }
    }
  }
}
