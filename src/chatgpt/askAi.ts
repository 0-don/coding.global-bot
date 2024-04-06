import dayjs from "dayjs";
import {
  CommandInteraction,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { ChatMessage, gpt } from "../chatgpt.js";
import { BOT_CHANNELS } from "../lib/constants.js";
import { prisma } from "../prisma.js";

interface AskAi {
  interaction?: CommandInteraction;
  channel: TextChannel | ThreadChannel;
  user: User;
  text: string;
  fileLink?: string;
  withHeaders?: boolean;
  onReply?: boolean;
}

const MSG_LIMIT = 2000;
const EDIT_THRESHOLD = 25;

export const askAi = async (props: AskAi) => {
  if (!props?.text?.length) return;

  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id, guildId: props.channel.guild.id },
  });

  if (!memberGuild) return null;

  const olderThen30Min = dayjs(memberGuild.gptDate).isBefore(
    dayjs().subtract(30, "minute")
  );

  const stream = gpt.sendMessage({
    text: props.text,
    systemMessage: `You are coding.global AI, a large language model trained by coding.global. 
    You answer as concisely as possible for each response, if its programming related you add specific code tag to the snippet.
    If you have links add <> tags around them. ${props.onReply ? "Be extremly conisce and simple try either returning only code oder a small explanation" : ""} 
    Current date: ${new Date().toISOString()}`,
    fileLink: props.fileLink,
    parentMessageId: (!olderThen30Min && memberGuild.gptId) || undefined,
  });

  let messageContent = props?.withHeaders
    ? `${props.fileLink ? `${props.fileLink}\n` : ""}**<@${props.user.id}> ${
        props.user.username
      }'s Question:**\n\n\`${props.text.replaceAll("`", "")}\`\n\n`
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

    if (messageCount >= EDIT_THRESHOLD && messageContent.length <= MSG_LIMIT) {
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

  if (props.onReply) {
    const channel = props.channel.client.channels.cache.find(
      (channel) => (channel as TextChannel).name === BOT_CHANNELS.at(0)
    );

    await props.channel.send(
      `**go to <#${channel?.id}> to continue the conversation with the \`/ai\` command.**`
    );
  }

  await prisma.memberGuild.update({
    where: {
      member_guild: {
        guildId: props.channel.guild.id,
        memberId: props.user.id,
      },
    },
    data: { gptId: chatMessage?.id, gptDate: new Date() },
  });
};
