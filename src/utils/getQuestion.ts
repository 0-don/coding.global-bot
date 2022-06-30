import axios from 'axios';
import type { QuestionRequest } from '../types/types';
import { MAX_QUESTION_LENGTH, MAX_RETRIES } from './constants';

export const getQuestion = async (): Promise<QuestionRequest> => {
  let questionRequest: { data: QuestionRequest } = {
    data: {
      q: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      a: [],
    },
  };

  let i = 0;
  while (questionRequest.data.q?.length > MAX_QUESTION_LENGTH) {
    try {
      questionRequest = await axios.get<QuestionRequest>(
        'http://api.textcaptcha.com/example.json',
        { timeout: 750 }
      );
    } catch (_) {}

    if (i > MAX_RETRIES) break;
    i++;
  }

  if (questionRequest.data.q?.length > MAX_QUESTION_LENGTH || i > MAX_RETRIES) {
    questionRequest = {
      data: {
        q: '1 + 1 = ?',
        a: ['c81e728d9d4c2f636f067f89cc14862c'],
      },
    };
  }

  return questionRequest.data;
};
