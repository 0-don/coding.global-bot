import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import type { Client } from 'discord.js';

const prisma = new PrismaClient();

export default {
  name: 'ready',
  once: true,
  execute(client: Client<boolean>) {
    log(`Ready! Logged in as ${client.user?.tag}`);

    prisma
  },
};
