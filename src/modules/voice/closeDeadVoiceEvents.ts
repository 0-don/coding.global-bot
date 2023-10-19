import dayjs from 'dayjs';
import { prisma } from '../../prisma.js';

export const closeDeadVoiceEvents = async () => {
  // roll dice with if statemen 1/10 chance to run
  if (Math.floor(Math.random() * 10) === 0) return;

  const allOpenVoiceEvents = await prisma.guildVoiceEvents.findMany({
    where: { leave: null },
  });

  // dayjs if event is older than 10 days delete it
  allOpenVoiceEvents.forEach(async (event) => {
    if (dayjs().diff(dayjs(event.join), 'days') > 10) {
      await prisma.guildVoiceEvents.delete({ where: { id: event.id } });
    }
  });
};
