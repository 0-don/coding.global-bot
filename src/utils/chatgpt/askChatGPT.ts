import dayjs from 'dayjs';
import type {
  CacheType,
  CommandInteraction,
  TextChannel,
  User,
} from 'discord.js';
import { gpt } from '../../chatgpt.js';
import { prisma } from '../../prisma.js';
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
    `${'```\n'}${text}${'```'}`,
  ];

  const olderThen30Min = dayjs(memberGuild.gptDate).isBefore(
    dayjs().subtract(30, 'minute')
  );

  let counter = 0;

  let interactionUsedAt: number = 0;
  const res = await gpt.sendMessage(text as string, {
    parentMessageId: (!olderThen30Min && memberGuild.gptId) || undefined,
    systemMessage: `You are coding.global AI, a large language model trained by OpenAI. You answer as concisely as possible for each responseIf you are generating a list, do not have too many items. Current date: ${new Date().toISOString()}\n\n`,
    onProgress: async (partialResponse) => {
      counter++;
      const text = [...content, partialResponse.text].join('\n');
      if (counter % 10 === 0 && text.length < 2000) {
        // await interaction.editReply({
        //   content: [...content, partialResponse.text].join('\n'),
        //   allowedMentions: { users: [] },
        // });

        interactionUsedAt = await chunkedSend({
          content: text,
          interaction,
          interactionUsedAt,
        });
      }
    },
  });

  // save gptId
  await prisma.memberGuild.update({
    where: { id: memberGuild.id },
    data: { gptId: res.id, gptDate: new Date() },
  });

  const fullContent = [...content, res.text].join('\n');

  if (interactionUsedAt && interaction) {
    const leftContent = fullContent.slice(interactionUsedAt);
    await chunkedSend({
      content: leftContent,
      channel: interaction.channel as TextChannel,
    });
  }

  return [...content, res.text].join('\n');
};
