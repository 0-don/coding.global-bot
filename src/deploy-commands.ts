import 'dotenv/config';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with pong!'),
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Replies with server info!'),
  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Replies with user info!'),
].map((command) => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest
  .put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
  .then(() => console.log('Successfully registered application commands.'))
  .catch(console.error);
