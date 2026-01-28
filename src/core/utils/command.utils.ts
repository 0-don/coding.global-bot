import { BOT_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import type {
  CommandInteraction,
  InteractionDeferReplyOptions,
  InteractionEditReplyOptions,
  MessagePayload,
} from "discord.js";

// Discord API error codes for missing resources
export const UNKNOWN_MESSAGE = 10008;
export const UNKNOWN_CHANNEL = 10003;
export const UNKNOWN_INTERACTION = 10062;

export function isDiscordNotFoundError(error: unknown): boolean {
  const code = (error as { code?: number }).code;
  return (
    code === UNKNOWN_MESSAGE ||
    code === UNKNOWN_CHANNEL ||
    code === UNKNOWN_INTERACTION
  );
}

export async function safeDeferReply(
  interaction: CommandInteraction,
  options?: InteractionDeferReplyOptions,
): Promise<boolean> {
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === UNKNOWN_INTERACTION) return false;
    throw error;
  }
}

export async function safeEditReply(
  interaction: CommandInteraction,
  options: string | MessagePayload | InteractionEditReplyOptions,
): Promise<boolean> {
  try {
    await interaction.editReply(options);
    return true;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (
      code === UNKNOWN_MESSAGE ||
      code === UNKNOWN_CHANNEL ||
      code === UNKNOWN_INTERACTION
    ) {
      return false;
    }
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
