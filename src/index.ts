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
import {
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import "dotenv/config";
import "./deploy-commands";
import { filesPaths } from "./modules/helpers.js";
import "./types";

Chart.register(
  LineController,
  LineElement,
  LinearScale,
  CategoryScale,
  PointElement,
  TimeSeriesScale,
  Filler,
);

const token = process.env.TOKEN;

// discord client config
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.GuildScheduledEvent,
    Partials.User,
  ],
});

const main = async () => {
  // add slash commands on client globally
  client.commands = new Collection();

  // get commands path and files
  const commandFiles = filesPaths("commands");
  // get each command file and put them in to command collection on client
  for (const commandFile of commandFiles) {
    const command = await import(commandFile);

    (client as any).commands.set(command.default.data.name, command.default);
  }

  // get events path and files
  const eventsFiles = filesPaths("events");
  // get event files and create event listeners
  for (const eventsFile of eventsFiles) {
    const { default: event } = await import(eventsFile);
    // either once or on
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  await client.login(token);

  client.user?.setPresence({
    activities: [{ name: ".gg/coding", type: ActivityType.Watching }],
  });
};

main();
