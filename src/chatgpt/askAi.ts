import { TextChannel, ThreadChannel, User } from "discord.js";
import { ChatMessage, gpt } from "../chatgpt.js";
import { prisma } from "../prisma.js";
interface AskAi {
  channel: TextChannel | ThreadChannel;
  user: User;
  text: string;
}

const MSG_LIMIT = 2000;

export const askAi = async (props: AskAi) => {
  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id, guildId: props.channel.guild.id },
  });

  if (!memberGuild) return null;

  const stream = gpt.sendMessage({
    text: props.text,
    systemMessage: `You are coding.global AI, a large language model trained by coding.global. 
    You answer as concisely as possible for each response, if its programming related you add specific code tag to the snippet.
    If you have links add <> tags around them. 
    Current date: ${new Date().toISOString()}`,
    parentMessageId: memberGuild.gptId,
  });

  let messageContent = "";
  let currentMessage = await props.channel.send("Processing...");
  let chatMessage: ChatMessage | null = null;
  let messageCount = 0;
  const editThreshold = 2; // Number of messages to accumulate before editing

  for await (const msg of stream) {
    messageContent += msg.delta?.content || "";
    messageCount++;
    chatMessage = msg;

    if (messageCount >= editThreshold || messageContent.length <= MSG_LIMIT) {
      messageContent.length > 0 && (await currentMessage.edit(messageContent));
      messageCount = 0;
    }

    if (messageContent.length >= MSG_LIMIT) {
      currentMessage = await props.channel.send("Continuing...");
      messageContent = messageContent.substring(MSG_LIMIT);
    }
  }

  if (messageContent.length && messageCount) {
    currentMessage.edit(messageContent);
  }

  await prisma.memberGuild.update({
    where: { member_guild: { guildId: props.channel.guild.id, memberId: props.user.id } },
    data: { gptId: chatMessage?.id },
  });
};
