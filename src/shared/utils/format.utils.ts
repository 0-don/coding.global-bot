export function placementSuffix(i: number) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st.";
  }
  if (j == 2 && k != 12) {
    return i + "nd.";
  }
  if (j == 3 && k != 13) {
    return i + "rd.";
  }
  return i + "th.";
}

export const codeString = (text: string | number) => "`" + text + "`";

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
