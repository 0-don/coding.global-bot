import dayjs from "dayjs";
import { CommandInteraction, TextChannel, ThreadChannel, User } from "discord.js";
import { ChatMessage, gpt } from "../chatgpt.js";
import { prisma } from "../prisma.js";

interface AskAi {
  interaction?: CommandInteraction;
  channel: TextChannel | ThreadChannel;
  user: User;
  text: string;
  fileLink?: string;
  withHeaders?: boolean;
}

const MSG_LIMIT = 2000;
const EDIT_THRESHOLD = 3;

export const askAi = async (props: AskAi) => {
  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id, guildId: props.channel.guild.id },
  });

  if (!memberGuild) return null;

  const olderThen30Min = dayjs(memberGuild.gptDate).isBefore(dayjs().subtract(30, "minute"));

  const stream = gpt.sendMessage({
    text: props.text,
    systemMessage: `You are coding.global AI, a large language model trained by coding.global. 
    You answer as concisely as possible for each response, if its programming related you add specific code tag to the snippet.
    If you have links add <> tags around them. 
    Current date: ${new Date().toISOString()}`,
    fileLink: props.fileLink,
    parentMessageId: (!olderThen30Min && memberGuild.gptId) || undefined,
  });

  let messageContent = props?.withHeaders
    ? `${props.fileLink ? `${props.fileLink}\n` : ""}**<@${props.user.id}> ${props.user.username}'s Question:**\n\n`
    : "";
  let currentMessage =
    (await props.interaction?.editReply(messageContent + "Processing...")) ||
    (await props.channel.send(messageContent + "Processing..."));
  let chatMessage: ChatMessage | null = null;
  let messageCount = 0;

  for await (const msg of stream) {
    messageContent += msg.choice?.delta?.content || "";
    messageCount++;
    chatMessage = msg;

    if (messageCount >= EDIT_THRESHOLD || messageContent.length <= MSG_LIMIT) {
      messageContent.length > 0 && (await currentMessage.edit(messageContent));
      messageCount = 0;
    }

    if (messageContent.length >= MSG_LIMIT) {
      await currentMessage.edit(messageContent.substring(0, MSG_LIMIT));
      currentMessage = await props.channel.send("Continuing...");
      messageContent = messageContent.substring(MSG_LIMIT);
    }
  }

  if (messageContent.length && messageCount) {
    currentMessage.edit(messageContent);
  }

  await prisma.memberGuild.update({
    where: { member_guild: { guildId: props.channel.guild.id, memberId: props.user.id } },
    data: { gptId: chatMessage?.id, gptDate: new Date() },
  });
};
