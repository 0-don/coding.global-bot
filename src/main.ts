import "@dotenvx/dotenvx/config";

import {
  botLogger,
  initTelemetry,
  shutdownTelemetry,
} from "@/lib/telemetry";

initTelemetry("coding-global-bot");

import { AttachmentRefreshQueueService } from "@/core/services/attachments/attachment-refresh-queue.service";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";
import { ConfigValidator } from "@/shared/config/validator";
import { ActivityType, GatewayIntentBits, Partials } from "discord.js";
import { Client } from "discordx";
import "./bot";
import "./elysia";

ConfigValidator.validateConfig();

const token = process.env.TOKEN;

// discord client config
export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
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
});

bot.once("clientReady", async () => {
  await bot.initApplicationCommands();
  process.env.DOCKER && MemberUpdateQueueService.start();
  process.env.DOCKER && AttachmentRefreshQueueService.start();
  botLogger.info("Bot started", { clientId: bot.user?.id });
});

bot.on("interactionCreate", (interaction) => {
  // Ignore DMs - only work in guild (server)
  if (!interaction.guild) return;
  // Skip command execution if not running in Docker
  // if (!process.env.DOCKER) return;
  void bot.executeInteraction(interaction);
});

bot.on("messageCreate", (message) => {
  // Ignore DMs - only work in guild (server)
  if (!message.guild) return;
  // // Skip command execution if not running in Docker
  // if (!process.env.DOCKER) return;
  void bot.executeCommand(message);
});

bot.on(
  "messageReactionAdd",
  (reaction, user) => void bot.executeReaction(reaction, user),
);

// Graceful shutdown
process.on("SIGTERM", async () => {
  botLogger.info("Received SIGTERM, shutting down");
  await shutdownTelemetry();
  process.exit(0);
});

process.on("SIGINT", async () => {
  botLogger.info("Received SIGINT, shutting down");
  await shutdownTelemetry();
  process.exit(0);
});

const main = async () => {
  if (!token) {
    botLogger.error("Could not find TOKEN in environment");
    throw Error("Could not find TOKEN in your environment");
  }

  await bot.login(token);

  bot.user?.setPresence({
    activities: [{ name: ".gg/coding", type: ActivityType.Watching }],
  });
};

setInterval(
  () =>
    fetch("https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api").catch(
      (e) => botLogger.error("Ping error", { error: String(e) }),
    ),
  300000,
);

main();
