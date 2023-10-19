import * as deepl from 'deepl-node';
import { dirname } from 'dirname-filename-esm';
import fs from 'fs';
import path from 'path';

const translator = new deepl.Translator(process.env.DEEPL!);

export function placementSuffix(i: number) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + 'st.';
  }
  if (j == 2 && k != 12) {
    return i + 'nd.';
  }
  if (j == 3 && k != 13) {
    return i + 'rd.';
  }
  return i + 'th.';
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
  const __dirname = dirname(import.meta);
  const filePath = path.join(__dirname, '..', dir);


  const files = fs
    .readdirSync(filePath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  const filePaths = files.map((file) => path.join('file:///', filePath, file));

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

export const codeString = (text: string | number) => '`' + text + '`';

export const translate = async (text: string) => {
  const length = text.split(' ').length;
  if (length < 4) {
    return 'Please add more words';
  }
  const translated = await translator.translateText(text, null, 'en-GB');
  return translated.text;
};


// sleep function
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
