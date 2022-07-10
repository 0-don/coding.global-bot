import { PrismaClient } from '@prisma/client';
import type { ChartConfiguration } from 'chart.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { log } from 'console';
import dayjs from 'dayjs';
import type { Client, Guild } from 'discord.js';
import fs from 'fs';
import path from 'path';
import type { ChartDataset } from '../../types/types';
import { chartConfig, chartJSNodeCanvas } from '../constants';
import { getDaysArray } from '../helpers';

const prisma = new PrismaClient();

type GuildMemberCountChart = {
  image?: Buffer;
  imgPath?: string;
  data?: ChartDataset[];
  error?: string;
};

export const guildMemberCountChart = async (
  guild: Guild
): Promise<GuildMemberCountChart> => {
  const guildId = guild.id;
  const guildName = guild.name;

  await prisma.guild.upsert({
    where: { guildId },
    create: { guildId, guildName },
    update: { guildName },
  });

  const dates = (await guild.members.fetch())
    .map((member) => member.joinedAt || new Date())
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dates[0]) return { error: 'No members found' };

  const startEndDateArray = getDaysArray(dates[0], new Date());

  const dataDb = startEndDateArray.map((date) => ({
    guildId: guildId,
    date: dayjs(date).format(),
    memberCount: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
  }));

  const data: ChartDataset[] = dataDb.map(({ date, memberCount }) => ({
    x: dayjs(date).toDate(),
    y: memberCount,
  }));

  const config = chartConfig(data as any);

  const image = await chartJSNodeCanvas.renderToBuffer(
    config as unknown as ChartConfiguration,
    'image/png'
  );

  const imgPath = path.join(path.resolve(), `${guildId}.png`);
  fs.writeFileSync(imgPath, image);

  log(`Created guild member count ${guildName}`);

  return { image, imgPath, data };
};
