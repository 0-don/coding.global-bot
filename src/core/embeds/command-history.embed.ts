import dayjs from "dayjs";
import { APIEmbed } from "discord.js";
import { MemberCommandHistory } from "@/generated/prisma/client";
import {
  BOT_ICON,
  COMMAND_HISTORY_TEMPLATE,
  RED_COLOR,
} from "@/shared/config/branding";
import { codeString, placementSuffix } from "@/shared/utils/format.utils";

export const commandHistoryEmbed = (
  history: MemberCommandHistory[],
): APIEmbed => {
  const historyText = history.map(
    ({ memberId, command, channelId, createdAt }, i) =>
      `${codeString(placementSuffix(i + 1))} <@${memberId}>: **${command}** in <#${channelId}> at <t:${dayjs(createdAt).unix()}:R>`,
  );

  return {
    color: RED_COLOR,
    title: `🤖 Command History Overview`,
    description: `
**last ${history.length} commands used**

${historyText.join("\n")}

`,
    timestamp: new Date().toISOString(),
    footer: {
      text: COMMAND_HISTORY_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};
