import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client, Collection, Intents } from 'discord.js';

const token = process.env.TOKEN;

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.default.data.name, command.default);
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const { default: event } = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// client.once('ready', () => {
//   console.log('Ready!');
// });

// client.on('interactionCreate', async (interaction) => {
//   if (!interaction.isCommand()) return;

//   const command = client.commands.get(interaction.commandName);

//   if (!command) return;

//   try {
//     await command.execute(interaction);
//   } catch (error) {
//     console.error(error);
//     await interaction.reply({
//       content: 'There was an error while executing this command!',
//       ephemeral: true,
//     });
//   }
// });

client.login(token);
