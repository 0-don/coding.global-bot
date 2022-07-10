import axios from 'axios';
import type { Message } from 'discord.js';

const apiKeys = [
  'trnsl.1.1.20191211T121854Z.27784f1367fa6db7.827eb1675f9c8fac17722471a60f8a31177a8660',
  'trnsl.1.1.20191218T125149Z.248e86ec58fbbdb1.d53a66b86fa99001f59640849e8ff988d87a2bd1',
  'trnsl.1.1.20191218T160702Z.5c96a38119dae4e9.b81ea70f889346342368e3c99590b2502e9935ba',
  'trnsl.1.1.20191218T160843Z.c160b6fffcfe4590.bd1a12d05e1336b8d2d0564c8be5af9a9b5ffebd',
  'trnsl.1.1.20191218T161108Z.ed9063d04beab969.fe55f07245527aed06b5ee4cc9de93212de6f9b1',
  'trnsl.1.1.20191219T111503Z.134a0f038aa28724.d816739d3eeae25227c83f6770b34cd0138a5b67',
  'trnsl.1.1.20191219T111842Z.abccb34bbe794d43.ae6642ea0434b8f265eaeb091d05886030104ff4',
  'trnsl.1.1.20191219T112018Z.e9233a5257de5f39.7bebff3024c8cebefdcfb319ffa20fe4ddb4c0e3',
  'trnsl.1.1.20191219T112308Z.f219ee2e56246fda.1b2362ea7b9fe0489711d2685aac58b04e24cb89',
  'trnsl.1.1.20191219T161925Z.845b11c21714ef10.cc55cb7d74def271db8f91d4673122c983f40c4b',
];

export const translate = async (message: Message<boolean>) => {
  console.log(message);

  message.
  // const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=trnsl.1.1.20191218T125149Z.248e86ec58fbbdb1.d53a66b86fa99001f59640849e8ff988d87a2bd1&text=${text}&lang=${lang}`;

  // try {
  //   const response = await axios.get(url);
  //   console.log(response);
  // } catch (error) {
  //   console.log(error);
  // }
};
