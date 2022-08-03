import { log } from 'console';
import type { Event } from '../types';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    log(`Ready! Logged in as ${client.user?.tag}`);
  },
} as Event<'ready'>;
