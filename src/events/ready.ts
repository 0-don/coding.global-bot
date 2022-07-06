import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import { log } from 'console';
import type { Client } from 'discord.js';
import { getDaysArray } from '../utils/helpers';

const prisma = new PrismaClient();

export default {
  name: 'ready',
  once: true,
  async execute(client: Client<boolean>) {
    log(`Ready! Logged in as ${client.user?.tag}`);

    const guilds = (await client.guilds.fetch()).values();

    for (let guild of guilds) {
      const guildId = guild.id;
      const guildName = guild.name;

      const guildDc = await client.guilds.fetch(guildId);

      await prisma.guild.upsert({
        where: { guildId },
        create: { guildId, guildName },
        update: { guildName },
      });

      const dates = (await guildDc.members.fetch())
        .map((member) => member.joinedAt || new Date())
        .sort((a, b) => a.getTime() - b.getTime());

      const startEndDateArray = getDaysArray(
        dates[0]!,
        dates[dates.length - 1]!
      );

      const data = startEndDateArray.map((date) => ({
        guildId: guildId,
        date: dayjs(date).format(),
        memberCount: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
      }));

      await prisma.guildMemberCount.createMany({ data, skipDuplicates: true });
      log('Created guild member count');
    }
  },
};
