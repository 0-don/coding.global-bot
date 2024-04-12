import dayjs from "dayjs";
import {
  CommandInteraction,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { gpt } from "../chatgpt.js";
import { BOT_CHANNELS } from "../lib/constants.js";
import { prisma } from "../prisma.js";

interface AskAiProps {
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

export const askAi = async (props: AskAiProps) => {
  if (!props.text.length) return;

  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id, guildId: props.channel.guild.id },
  });

  if (!memberGuild) return null;

  const isOlderThan30Min = dayjs(memberGuild.gptDate).isBefore(
    dayjs().subtract(30, "minute")
  );
  const systemMessage = `You are coding.global AI, trained to respond concisely. ${props.onReply ? "Return only code or a brief explanation." : ""} Current date: ${new Date().toISOString()}`;

  const stream = gpt.sendMessage({
    text: props.text,
    systemMessage,
    fileLink: props.fileLink,
    parentMessageId: isOlderThan30Min ? undefined : memberGuild.gptId,
  });

  let messageContent = props.withHeaders
    ? `${props.fileLink ? `${props.fileLink}\n` : ""}**<@${props.user.id}> ${props.user.username}'s Question:**\n\n\`${props.text.replaceAll("`", "")}\`\n\n`
    : "";
  let currentMessage = await (props.interaction?.editReply(
    messageContent + "Processing..."
  ) || props.channel.send(messageContent + "Processing..."));
  let messageCount = 0;
  let lastChatMessageId: string | null = null;
  for await (const msg of stream) {
    messageContent += msg.choice?.delta?.content || "";
    lastChatMessageId = msg.id;
    messageCount++;

    if (messageCount >= EDIT_THRESHOLD || messageContent.length >= MSG_LIMIT) {
      await currentMessage.edit(
        messageContent.substring(0, Math.min(MSG_LIMIT, messageContent.length))
      );
      if (messageContent.length >= MSG_LIMIT) {
        currentMessage = await props.channel.send("Continuing...");
        messageContent = messageContent.substring(MSG_LIMIT);
      }
      messageCount = 0;
    }
  }

  if (messageContent.length) {
    await currentMessage.edit(messageContent);
  }

  if (props.onReply) {
    const channel = props.channel.client.channels.cache.find(
      (ch) => (ch as TextChannel).name === BOT_CHANNELS.at(0)
    );

    if (props.channel.isTextBased()) {
      await props.channel.send(
        `**Go to <#${channel?.id}> to continue the conversation with the \`/ai\` command.**`
      );
    }
  }

  await prisma.memberGuild.update({
    where: {
      member_guild: {
        guildId: props.channel.guild.id,
        memberId: props.user.id,
      },
    },
    data: { gptId: lastChatMessageId, gptDate: new Date() },
  });
};
