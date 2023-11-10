import { TextChannel, ThreadChannel, User } from "discord.js";
import { ChatMessage, gpt } from "../chatgpt.js";
import { prisma } from "../prisma.js";
interface AskAi {
  channel: TextChannel | ThreadChannel;
  user: User;
  text: string;
}

export const askAi = async (props: AskAi) => {
  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id },
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
  const editThreshold = 5; // Number of messages to accumulate before editing

  for await (const msg of stream) {
    messageContent += msg.delta?.content || "";
    messageCount++;

    if (messageCount >= editThreshold || messageContent.length <= 2000) {
      messageContent.length > 0 && (await currentMessage.edit(messageContent));
      messageCount = 0; // Reset counter after edit
    }

    if (messageContent.length >= 2000) {
      currentMessage = await props.channel.send("Continuing...");
      messageContent = messageContent.substring(2000);
    }

    chatMessage = msg;
  }

  if (messageContent.length > 0) {
    await currentMessage.edit(messageContent);
  }

  await prisma.memberGuild.update({
    where: { member_guild: { guildId: props.channel.guild.id, memberId: props.user.id } },
    data: { gptId: chatMessage?.conversationId },
  });
};
