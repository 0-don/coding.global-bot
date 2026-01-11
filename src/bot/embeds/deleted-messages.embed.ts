import dayjs from "dayjs";
import { APIEmbed } from "discord.js";
import { MemberDeletedMessages } from "@/generated/prisma/client";
import {
  BOT_ICON,
  DELETED_MESSAGES_HISTORY_TEMPLATE,
  RED_COLOR,
} from "@/shared/config/branding";
import { codeString, placementSuffix } from "@/shared/utils/format.utils";

export const deletedMessagesHistoryEmbed = (
  history: MemberDeletedMessages[],
): APIEmbed => {
  const historyText = history.map(
    ({ channelId, deletedByMemberId, messageMemberId, createdAt }, i) =>
      `${codeString(placementSuffix(i + 1))} <@${deletedByMemberId}> deleted msg from <@${messageMemberId}> in <#${channelId}> at <t:${dayjs(createdAt).unix()}:R>`,
  );

  return {
    color: RED_COLOR,
    title: `🗑️ Deleted Messages Overview`,
    description: `
**last ${history.length} deleted messages**

${historyText.join("\n")}

`,
    timestamp: new Date().toISOString(),
    footer: {
      text: DELETED_MESSAGES_HISTORY_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};
