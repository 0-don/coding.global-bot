import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';

export const chunkedSend = async ({
  content,
  channel,
  interaction,
  interactionUsedAt = 0,
}: {
  content: string;
  channel?: TextChannel;
  interaction?: CommandInteraction<CacheType>;
  interactionUsedAt?: number;
}) => {
  const splitContent = content.split(' ');

  const chunks = [];

  let currentChunk = '';

  for (const word of splitContent) {
    if (currentChunk.length + word.length > 2000) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += word + ' ';
  }

  chunks.push(currentChunk);

  for (const chunk of chunks) {
    if (interaction) {
      await interaction.editReply({
        content: chunk,
        allowedMentions: { users: [] },
      });
      interactionUsedAt = chunk.length;
    } else {
      await channel!.send({
        content: chunk,
        allowedMentions: { users: [] },
      });
    }
  }

  return interactionUsedAt;
};
