import { log } from 'console';
import type { Client } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  execute(client: Client<boolean>) {
    log(`Ready! Logged in as ${client.user?.tag}`);
  },
};
