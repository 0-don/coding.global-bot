import type { ChartConfiguration } from 'chart.js';
import { log } from 'console';
import dayjs from 'dayjs';
import type { Guild } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../prisma.js';
import type { ChartDataset, GuildMemberCountChart } from '../../types/index.js';
import { chartConfig, chartJSNodeCanvas } from '../constants.js';
import { getDaysArray } from '../helpers.js';

export const guildMemberCountChart = async (
  guild: Guild
): Promise<GuildMemberCountChart> => {
  // get guild data
  const guildId = guild.id;
  const guildName = guild.name;

  // create or update guild
  const { lookback } = await prisma.guild.upsert({
    where: { guildId },
    create: { guildId, guildName },
    update: { guildName },
  });

  // get member join dates and sort ascending
  const dates = (await guild.members.fetch())
    .map((member) => member.joinedAt || new Date())
    .sort((a, b) => a.getTime() - b.getTime());

  // if no dates, return
  if (!dates[0]) return { error: 'No members found' };

  // create date array from first to today for each day
  const startEndDateArray = getDaysArray(
    dates[0],
    dayjs().add(1, 'day').toDate()
  );

  // get member count for each day and format it for chartjs
  const data: ChartDataset[] = startEndDateArray.map((date) => ({
    x: dayjs(date).toDate(),
    y: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
  }));

  let thirtyDaysCount = data[data.length - 1]?.y;
  let sevedDaysCount = data[data.length - 1]?.y;
  let oneDayCount = data[data.length - 1]?.y;

  // count total members for date ranges
  if (data.length > 31)
    thirtyDaysCount = data[data.length - 1]!.y - data[data.length - 30]!.y;
  if (data.length > 8)
    sevedDaysCount = data[data.length - 1]!.y - data[data.length - 7]!.y;
  if (data.length > 3)
    oneDayCount = data[data.length - 1]!.y - data[data.length - 2]!.y;

  // const link = await megaUpload(JSON.stringify(data, null, 1), 'chart.json');

  // create chartjs config
  const config = chartConfig(
    data.slice(
      // splice only the lookback range if it fits. 2 values minium needed for chart
      data.length - 2 < lookback ? 0 : lookback * -1
    ) as any
  );

  // render image from chartjs config as png
  const image = await chartJSNodeCanvas.renderToBuffer(
    config as unknown as ChartConfiguration,
    'image/png'
  );

  // crete local img file
  const fileName = `${guildId}.png`;
  const imgPath = path.join(path.resolve(), fileName);
  fs.writeFileSync(imgPath, image);

  log(`Created guild member count ${guildName}`);

  // return chart data
  return {
    // link,
    fileName,
    imgPath,
    thirtyDaysCount,
    sevedDaysCount,
    oneDayCount,
    lookback,
  };
};
