import { log } from 'console';
import type { Client } from 'discord.js';
import { guildMemberCountDb } from '../utils/guilds/guildMemberCountDb';
import { CronJob } from 'cron';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<boolean>) {
    const guilds = (await client.guilds.fetch()).values();
    for (let guild of guilds) {
      new CronJob(
        '55 23 * * *',
        async function () {
          await guildMemberCountDb(guild, client);
        },
        null,
        true,
        'Europe/Berlin',
        null,
        true
      );
    }

    log(`Ready! Logged in as ${client.user?.tag}`);
  },
};
