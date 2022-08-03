import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';
import './deploy-commands';
import { filesPaths } from './utils/helpers';

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

// add slash commands on client globally
client.commands = new Collection();

// get commands path and files
const commandFiles = filesPaths('commands');
// get each command file and put them in to command collection on client
for (const commandFile of commandFiles) {
  const command = require(commandFile);
  client.commands.set(command.default.data.name, command.default);
}

// get events path and files
const eventsFiles = filesPaths('events');
// get event files and create event listeners
for (const eventsFile of eventsFiles) {
  const { default: event } = require(eventsFile);
  // either once or on
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// client.on("")

client.login(token);
