import 'dotenv/config';

import { REST } from '@discordjs/rest';
import { error, log } from 'console';
import { Routes } from 'discord-api-types/v9';
import { filesPaths } from './utils/helpers';

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

// create empty commands array
const commands = [];
// get command files
const commandFiles = filesPaths('commands');
// create json config from command files
for (const commandFile of commandFiles) {
  const command = require(commandFile);
  commands.push(command.default.data.toJSON());
}

// set rest api
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    log('Started refreshing application (/) commands.');

    // load commands on specifc guild
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    log('Successfully reloaded application (/) commands.');
  } catch (err) {
    error(err);
  }
})();
