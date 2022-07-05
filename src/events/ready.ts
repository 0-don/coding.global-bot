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

      const members = (await guildDc.members.fetch()).values();

      const dates: Date[] = [];
      for (let member of members) {
        if (member.joinedAt) dates.push(member.joinedAt);
      }

      const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());

      const startEndDateArray = getDaysArray(
        sortedDates[0]!,
        sortedDates[sortedDates.length - 1]!
      );

      const data = startEndDateArray.map((date) => ({
        guildId: guildId,
        date: dayjs(date).format(),
        memberCount: sortedDates.filter((d) => dayjs(d) <= dayjs(date)).length,
      }));

      await prisma.guildMemberCount.createMany({ data, skipDuplicates: true });
    }
  },
};
