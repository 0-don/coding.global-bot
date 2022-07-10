import axios from 'axios';
import type { Message } from 'discord.js';

const apiKeys = [
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
  'REDACTED_YANDEX_KEY',
];

export const translate = async (message: Message<boolean>) => {
  console.log(message);

  message.
  // const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=REDACTED_YANDEX_KEY&text=${text}&lang=${lang}`;

  // try {
  //   const response = await axios.get(url);
  //   console.log(response);
  // } catch (error) {
  //   console.log(error);
  // }
};
