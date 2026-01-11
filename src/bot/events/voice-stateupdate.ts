import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { handleVoiceStateUpdate } from "@/core/handlers/event-handlers/voice-state-update.handler";

@Discord()
export class VoiceStateUpdate {
  @On()
  async voiceStateUpdate(
    [oldVoiceState, newVoiceState]: ArgsOf<"voiceStateUpdate">,
    client: Client,
  ) {
    await handleVoiceStateUpdate(oldVoiceState, newVoiceState);
  }
}
