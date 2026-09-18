import { botLogger } from "@/lib/telemetry";
import { GatewayIntentBits } from "discord.js";

// Discord reports granted privileged intents as application flags. Each intent has
// a full-access bit and a "limited" bit, the latter granted below the 10k-user
// review threshold; either one means the gateway will accept the intent.
const APPLICATION_FLAGS = {
  GATEWAY_PRESENCE: 1 << 12,
  GATEWAY_PRESENCE_LIMITED: 1 << 13,
  GATEWAY_GUILD_MEMBERS: 1 << 14,
  GATEWAY_GUILD_MEMBERS_LIMITED: 1 << 15,
  GATEWAY_MESSAGE_CONTENT: 1 << 18,
  GATEWAY_MESSAGE_CONTENT_LIMITED: 1 << 19,
} as const;

export interface GrantedIntents {
  guildMembers: boolean;
  guildPresences: boolean;
  messageContent: boolean;
}

const ALL_GRANTED: GrantedIntents = {
  guildMembers: true,
  guildPresences: true,
  messageContent: true,
};

function fromFlags(flags: number): GrantedIntents {
  const has = (full: number, limited: number) =>
    (flags & full) !== 0 || (flags & limited) !== 0;

  return {
    guildMembers: has(
      APPLICATION_FLAGS.GATEWAY_GUILD_MEMBERS,
      APPLICATION_FLAGS.GATEWAY_GUILD_MEMBERS_LIMITED,
    ),
    guildPresences: has(
      APPLICATION_FLAGS.GATEWAY_PRESENCE,
      APPLICATION_FLAGS.GATEWAY_PRESENCE_LIMITED,
    ),
    messageContent: has(
      APPLICATION_FLAGS.GATEWAY_MESSAGE_CONTENT,
      APPLICATION_FLAGS.GATEWAY_MESSAGE_CONTENT_LIMITED,
    ),
  };
}

/**
 * Ask Discord which privileged intents this app may request. Requesting one that
 * has not been granted closes the gateway with 4014 and the process cannot start,
 * so this runs before login and the result decides what we ask for.
 */
export async function fetchGrantedIntents(
  token: string,
): Promise<GrantedIntents> {
  try {
    const res = await fetch("https://discord.com/api/v10/applications/@me", {
      headers: {
        Authorization: `Bot ${token}`,
        "User-Agent": "DiscordBot (https://coding-global.com, 1.0)",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // A bad token fails again at login with a clearer error; anything else is
      // transient. Assume the intents we had rather than silently degrading.
      botLogger.error("Could not read application flags, assuming granted", {
        status: res.status,
      });
      return ALL_GRANTED;
    }

    const app = (await res.json()) as { flags?: number };
    const granted = fromFlags(app.flags ?? 0);

    botLogger.info("Privileged intents resolved", {
      flags: app.flags ?? 0,
      ...granted,
    });

    return granted;
  } catch (e) {
    botLogger.error("Could not read application flags, assuming granted", {
      error: String(e),
    });
    return ALL_GRANTED;
  }
}

export function intentBitsFor(granted: GrantedIntents): GatewayIntentBits[] {
  const bits: GatewayIntentBits[] = [];
  if (granted.guildMembers) bits.push(GatewayIntentBits.GuildMembers);
  if (granted.guildPresences) bits.push(GatewayIntentBits.GuildPresences);
  if (granted.messageContent) bits.push(GatewayIntentBits.MessageContent);
  return bits;
}
