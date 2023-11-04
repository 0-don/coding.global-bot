import type { CacheType, CommandInteraction, TextChannel } from 'discord.js';

export const chunkedSend = async ({
  content,
  channel,
  interaction,
}: {
  content: string;
  channel?: TextChannel;
  interaction?: CommandInteraction<CacheType>;
}) => {
  const currentChannel = channel || (interaction?.channel as TextChannel);

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

  let interactionUsed = false;
  for (const chunk of chunks) {
    if (interaction && !interactionUsed) {
      await interaction.editReply({
        content: chunk,
        allowedMentions: { users: [] },
        embeds: [],
      });
      interactionUsed = true;
    } else {
      await currentChannel!.send({
        content: chunk,
        allowedMentions: { users: [] },
        embeds: [],
      });
    }
  }
};
