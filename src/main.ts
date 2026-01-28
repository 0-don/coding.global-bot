import { AttachmentRefreshQueueService } from "@/core/services/attachments/attachment-refresh-queue.service";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";
import { ConfigValidator } from "@/shared/config/validator";
import "@dotenvx/dotenvx/config";
import { error, log } from "console";
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
  log("Bot started");
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

const main = async () => {
  if (!token) throw Error("Could not find TOKEN in your environment");

  await bot.login(token);

  bot.user?.setPresence({
    activities: [{ name: ".gg/coding", type: ActivityType.Watching }],
  });
};

setInterval(
  () =>
    fetch("https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api").catch(
      (e) => error("Ping error:", e),
    ),
  300000,
);

main();
