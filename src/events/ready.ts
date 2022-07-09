import { log } from 'console';
import type { Client } from 'discord.js';
import { guildMemberCountChart } from '../utils/guilds/guildMemberCountChart';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<boolean>) {
    const guilds = (await client.guilds.fetch()).values();

    for (let guild of guilds) {
      await guildMemberCountChart(guild, client);
    }

    log(`Ready! Logged in as ${client.user?.tag}`);
  },
};
