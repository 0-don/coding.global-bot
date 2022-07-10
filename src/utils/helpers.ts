import path from 'path';
import fs from 'fs';

export function placementSuffix(i: number) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + 'st';
  }
  if (j == 2 && k != 12) {
    return i + 'nd';
  }
  if (j == 3 && k != 13) {
    return i + 'rd';
  }
  return i + 'th';
}

export const getDaysArray = (s: Date, e: Date) => {
  for (
    var a = [], d = new Date(s);
    d <= new Date(e);
    d.setDate(d.getDate() + 1)
  ) {
    a.push(new Date(d));
  }
  return a;
};

export const filesPaths = (dir: string) => {
  const filePath = path.join(__dirname, '..', dir);

  const files = fs
    .readdirSync(filePath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  const filePaths = files.map((file) => path.join(filePath, file));

  return filePaths;
};

export const parseJSON = (json: string | undefined | null) => {
  let parsed = undefined;

  if (!json) {
    return parsed;
  }

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    parsed = undefined;
  }

  return parsed;
};

export const codeString = (text: string) => '```' + text + '```';
