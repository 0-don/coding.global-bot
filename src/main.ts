import { dirname, importx } from "@discordx/importer";
import "@dotenvx/dotenvx/config";
import { error, warn } from "console";

// Handle network timeouts gracefully - don't crash the bot
process.on("unhandledRejection", (reason) => {
  const isNetworkError =
    reason instanceof Error &&
    (reason.message.includes("Connect Timeout Error") ||
      reason.name === "ConnectTimeoutError" ||
      (reason as NodeJS.ErrnoException).code === "UND_ERR_CONNECT_TIMEOUT");

  if (isNetworkError) {
    warn("[Network] Discord API connection timeout - will retry automatically");
    return;
  }

  error("[Unhandled Rejection]", reason);
});

import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  TimeSeriesScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { log } from "console";
import { ActivityType, GatewayIntentBits, Partials } from "discord.js";
import { Client } from "discordx";
import { Agent, RetryAgent } from "undici";
import "./elysia";
import { ConfigValidator } from "./lib/config-validator";
import { startMemberUpdateQueue } from "./lib/members/member-update-queue.service";

Chart.register(
  LineController,
  LineElement,
  LinearScale,
  CategoryScale,
  PointElement,
  TimeSeriesScale,
  Filler,
);

ConfigValidator.validateConfig();

const token = process.env.TOKEN;

// Custom agent with longer connect timeout and automatic retries
const baseAgent = new Agent({
  connect: {
    timeout: 30_000, // 30 seconds connect timeout (default is 10s)
  },
  bodyTimeout: 60_000, // 60 seconds body timeout
  headersTimeout: 60_000, // 60 seconds headers timeout
});

const agent = new RetryAgent(baseAgent, {
  maxRetries: 3,
  minTimeout: 1000, // 1 second initial delay
  maxTimeout: 30_000, // max 30 seconds between retries
  timeoutFactor: 2, // exponential backoff
  errorCodes: [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ENETDOWN",
    "ENETUNREACH",
    "EHOSTDOWN",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT", // Retry on connect timeout
  ],
});

// discord client config
export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.GuildScheduledEvent,
    Partials.User,
  ],
  silent: true,
  simpleCommand: {
    // prefix: "/",
  },
  rest: {
    timeout: 30_000, // 30 seconds request timeout
    retries: 3, // Retry failed requests up to 3 times
    agent, // Use custom agent with longer connect timeout
  },
});

bot.once("clientReady", async () => {
  await bot.initApplicationCommands();
  process.env.DOCKER && startMemberUpdateQueue();
  log("Bot started");
});

bot.on("interactionCreate", (interaction) => {
  // Ignore DMs - only work in guild (server)
  if (!interaction.guild) return;
  void bot.executeInteraction(interaction);
});

bot.on("messageCreate", (message) => {
  // Ignore DMs - only work in guild (server)
  if (!message.guild) return;
  void bot.executeCommand(message);
});

bot.on(
  "messageReactionAdd",
  (reaction, user) => void bot.executeReaction(reaction, user),
);

const main = async () => {
  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);

  // Let's start the bot
  if (!token) {
    throw Error("Could not find TOKEN in your environment");
  }

  // Log in with your bot token
  await bot.login(token);

  bot.user?.setPresence({
    activities: [{ name: ".gg/coding", type: ActivityType.Watching }],
  });
};

main();
