import type { Message, MessageEmbedOptions } from 'discord.js';

const exampleEmbed: MessageEmbedOptions = {
  color: '#00000',
  description: 'Select your roles',
};

export default {
  name: 'messageCreate',
  async execute(msg: Message<boolean>) {
    console.log(msg.client);
    if (msg.type === 'REPLY' && msg.reference?.messageId) {
      const replyMsg = await msg.channel.messages.fetch(
        msg.reference?.messageId
      );

      await replyMsg.edit({ embeds: [exampleEmbed] });
    }
  },
};
