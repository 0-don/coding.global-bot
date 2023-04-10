import { ChatMessage } from 'chatgpt';
import dayjs from 'dayjs';
import type { CacheType, CommandInteraction, User } from 'discord.js';
import { gpt } from '../../chatgpt.js';
import { prisma } from '../../prisma.js';
import { ChatGptError } from '../../types/index.js';
import { chunkedSend } from '../messages/chunkedSend.js';

export const askChatGPT = async ({
  interaction,
  user,
  text,
}: {
  interaction?: CommandInteraction<CacheType>;
  user: User;
  text: string;
}) => {
  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: user.id },
  });

  if (!memberGuild) return null;

  const content = [
    `**<@${user.id}> ${user.username}'s Question:**`,
    `\n**_${text}_**\n`,
  ];

  const olderThen30Min = dayjs(memberGuild.gptDate).isBefore(
    dayjs().subtract(30, 'minute')
  );

  let counter = 0;
  let res: ChatMessage | null = null;

  try {
    res = await gpt.sendMessage(text as string, {
      parentMessageId: (!olderThen30Min && memberGuild.gptId) || undefined,
      systemMessage: `You are coding.global AI, a large language model trained by coding.global. You answer as concisely as possible for each response If its programming related you add specifc code tag to the snippet. If you have links add <> tags around them. Current date: ${new Date().toISOString()}\n\n`,
      onProgress: async (partialResponse) => {
        counter++;
        const text = [...content, partialResponse.text].join('\n');
        if (counter % 20 === 0 && text.length < 2000 && interaction) {
          await chunkedSend({
            content: text,
            interaction,
          });
        }
      },
    });
  } catch (err) {
    const { message } = err as { message: string };
    const regex = message.match(/(?<=[{])(.*)(?=[}])/s);
    const { error } = JSON.parse(`{${regex?.[0] || ''}}`) as ChatGptError;

    return error.message;
  }

  if (!res) return null;

  // save gptId
  await prisma.memberGuild.update({
    where: { id: memberGuild.id },
    data: { gptId: res.id, gptDate: new Date() },
  });

  const fullContent = [...content, res.text].join('\n');

  return fullContent;
};
