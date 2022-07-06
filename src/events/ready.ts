import { log } from 'console';
import type { Client } from 'discord.js';
import { guildMemberCountDb } from '../utils/guilds/guildMemberCountDb';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<boolean>) {
    log(`Ready! Logged in as ${client.user?.tag}`);

    const guilds = (await client.guilds.fetch()).values();

    for (let guild of guilds) {
      await guildMemberCountDb(guild, client);
    }
  },
};
