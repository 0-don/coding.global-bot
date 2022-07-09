import { PrismaClient } from '@prisma/client';
import { log } from 'console';
import dayjs from 'dayjs';
import type { Client, OAuth2Guild } from 'discord.js';
import { getDaysArray } from '../helpers';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';
import fs from 'fs';
import path from 'path';
import type { ChartDataset } from '../../types/types';
import { chartConfig } from '../constants';

const prisma = new PrismaClient();

export const guildMemberCountChart = async (
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

  const startEndDateArray = getDaysArray(dates[0]!, new Date());

  const dataDb = startEndDateArray.map((date) => ({
    guildId: guildId,
    date: dayjs(date).format(),
    memberCount: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
  }));

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: 1200,
    height: 400,
    backgroundColour: '#34363c',
  });

  const data: ChartDataset[] = dataDb.map(({ date, memberCount }) => ({
    x: dayjs(date).toDate(),
    y: memberCount,
  }));

  const config = chartConfig(data as any);

  const image = await chartJSNodeCanvas.renderToBuffer(
    config as unknown as ChartConfiguration,
    'image/png'
  );

  const imgPath = path.join(path.resolve(), `1.png`);
  fs.writeFileSync(imgPath, image);

  log(`Created guild member count ${guildName}`);

  return { image, imgPath };
};
