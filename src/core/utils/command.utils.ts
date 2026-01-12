import { BOT_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import type {
  CommandInteraction,
  InteractionDeferReplyOptions,
} from "discord.js";

export async function safeDeferReply(
  interaction: CommandInteraction,
  options?: InteractionDeferReplyOptions & { withResponse: true },
): Promise<boolean> {
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 10062) return false;
    throw error;
  }
}

export function checkBotChannelRestriction(channelName: string): string | null {
  if (!ConfigValidator.isFeatureEnabled("IS_CONSTRAINED_TO_BOT_CHANNEL")) {
    return null;
  }

  if (!ConfigValidator.isFeatureEnabled("BOT_CHANNELS")) {
    ConfigValidator.logFeatureDisabled(
      "Bot Channel Restrictions",
      "BOT_CHANNELS",
    );
    return "Bot channel restrictions are enabled but no bot channels are configured.";
  }

  if (!BOT_CHANNELS.includes(channelName)) {
    return "Please use this command in the bot channel";
  }

  return null;
}

export function extractIds(interaction: CommandInteraction): {
  memberId: string | null;
  guildId: string | null;
} {
  return {
    memberId: interaction.member?.user.id ?? null,
    guildId: interaction.guild?.id ?? null,
  };
}
