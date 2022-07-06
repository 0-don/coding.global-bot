import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import dayjs from 'dayjs';
import type { Client, OAuth2Guild } from 'discord.js';
import { getDaysArray } from '../helpers';

const prisma = new PrismaClient();

export const guildMemberCountDb = async (
  guild: OAuth2Guild,
  client: Client<boolean>
) => {
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

  const startEndDateArray = getDaysArray(dates[0]!, dates[dates.length - 1]!);

  const data = startEndDateArray.map((date) => ({
    guildId: guildId,
    date: dayjs(date).format(),
    memberCount: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
  }));

  await prisma.guildMemberCount.createMany({ data, skipDuplicates: true });

  log(`Created guild member count ${guildName}`);
};
