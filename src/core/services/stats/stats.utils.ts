export const sumSeconds = (items: { sum: number }[]) =>
  items.reduce((acc, curr) => acc + Number(curr.sum), 0);

export const secondsToHours = (seconds: number) =>
  Number((seconds / 60 / 60).toFixed(2));

export const bigintToNumber = <T extends { count: bigint }>(item: T) => ({
  ...item,
  count: Number(item.count),
});

export const sumToHours = <T extends { sum: number }>(item: T) => ({
  ...item,
  sum: secondsToHours(item.sum),
});
