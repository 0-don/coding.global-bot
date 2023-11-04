import { createScheduler, createWorker } from "tesseract.js";

export const getTextFromImage = async (url: string) => {
  const scheduler = createScheduler();
  const worker1 = await createWorker("eng");
  const worker2 = await createWorker("deu");
  scheduler.addWorker(worker1);
  scheduler.addWorker(worker2);

  const results = await scheduler.addJob("recognize", url);

  await scheduler.terminate(); // It also terminates all workers.

  return results.data.text as string;
};
