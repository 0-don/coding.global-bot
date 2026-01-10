import dayjs from "dayjs";
import { APIEmbed } from "discord.js";
import {
  MemberCommandHistory,
  MemberDeletedMessages,
} from "../generated/prisma/client";
import { ToptatsExampleEmbed, UserStatsExampleEmbed } from "../types/index";
import {
  BOT_ICON,
  COMMAND_HISTORY_TEMPLATE,
  DELETED_MESSAGES_HISTORY_TEMPLATE,
  RED_COLOR,
  STATS_TEMPLATE,
  TOP_STATS_TEMPLATE,
} from "./constants";
import { codeString, placementSuffix } from "./helpers";

export const simpleEmbedExample = (): APIEmbed => ({
  color: RED_COLOR,
  description: `*`,
  timestamp: new Date().toISOString(),
  footer: {
    text: "*",
    icon_url: BOT_ICON,
  },
});

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

export const topStatsExampleEmbed = (args: ToptatsExampleEmbed): APIEmbed => {
  const mostActiveVoiceUserSumString = codeString(
    args.mostActiveVoiceUsers
      .reduce((acc, { sum }) => acc + sum, 0)
      .toLocaleString("en") + " hours",
  );

  const mostActiveVoiceUsersString = args.mostActiveVoiceUsers?.map(
    ({ memberId, sum, username }, i) =>
      `${codeString(
        placementSuffix(i + 1),
      )} <@${memberId}>: (${username}) ${codeString(
        sum.toLocaleString("en") + " hours",
      )}`,
  );

  const mostActiveVoiceChannelSumString = codeString(
    args.mostActiveVoiceChannels
      .reduce((a, b) => a + b.sum, 0)
      .toLocaleString("en") + " hours",
  );

  const mostActiveVoiceChannelString = args.mostActiveVoiceChannels.map(
    ({ sum, channelId }, i) =>
      `${codeString(placementSuffix(i + 1))} <#${channelId}>: ${codeString(
        sum.toLocaleString("en") + " hours",
      )}`,
  );

  const mostActiveMessageUsersSumString = codeString(
    args.mostActiveMessageUsers
      .reduce((a, b) => a + Number(b.count), 0)
      .toLocaleString("en") + " messages",
  );

  const mostHelpfulUsersString = args.mostHelpfulUsers.map(
    ({ count, memberId, username }, i) =>
      `${codeString(
        placementSuffix(i + 1),
      )} <@${memberId}>: (${username}) ${codeString(
        count.toLocaleString("en") + ` help${count > 1 ? "s" : ""}`,
      )}`,
  );

  const mostHelpfulUsersCount =
    args.mostHelpfulUsers
      .reduce((a, b) => a + Number(b.count), 0)
      .toLocaleString("en") + " helps";

  const mostActiveMessageUsersString = args.mostActiveMessageUsers.map(
    ({ count, memberId, username }, i) =>
      `${codeString(
        placementSuffix(i + 1),
      )} <@${memberId}>: (${username}) ${codeString(
        "messaged " + count.toLocaleString("en") + " times",
      )}`,
  );

  const mostActiveMessageChannelSumString = codeString(
    args.mostActiveMessageChannels
      .reduce((a, b) => a + Number(b.count), 0)
      .toLocaleString("en") + " messages",
  );

  const mostActiveMessageChannelString = args.mostActiveMessageChannels.map(
    ({ count, channelId }, i) =>
      `${codeString(placementSuffix(i + 1))} <#${channelId}>: ${codeString(
        Number(count).toLocaleString("en") + " messages",
      )}`,
  );

  return {
    color: RED_COLOR,
    title: `⭐ Top Stats Overview`,

    description: `
Top users and channels in the past __${args.lookback} Days__.

**Help | Top ${args.mostHelpfulUsers?.length ?? 0} - Helpers**
Top Helper Sum: ${mostHelpfulUsersCount}

${mostHelpfulUsersString.join("\n")}

**Messages | Top ${args.mostActiveMessageUsers?.length ?? 0} - Members**
Top Member Sum: ${mostActiveMessageUsersSumString} 

${mostActiveMessageUsersString.join("\n")}

**Voice | Top ${args.mostActiveVoiceUsers?.length ?? 0} - Members**
Top Member Sum: ${mostActiveVoiceUserSumString} 

${mostActiveVoiceUsersString.join("\n")}
`,
    // Messages | Top ${args.mostActiveMessageChannels?.length ?? 0} - Channels
    // Top Channel Sum: ${mostActiveMessageChannelSumString}

    // ${mostActiveMessageChannelString.join("\n")}
    // ########
    // Voice | Top ${args.mostActiveVoiceChannels?.length ?? 0} - Channels
    // Top Channel Sum: ${mostActiveVoiceChannelSumString}

    // ${mostActiveVoiceChannelString.join("\n")}
    timestamp: new Date().toISOString(),
    footer: {
      text: TOP_STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};

export const userStatsExampleEmbed = (
  args: UserStatsExampleEmbed,
): APIEmbed => {
  const lookbackCommand = codeString("/lookback-me");
  const mostActiveTextChannelString = args.mostActiveTextChannelId
    ? `<#${args.mostActiveTextChannelId}>`
    : "";
  const mostActiveTextChannelCountString = codeString(
    args.mostActiveTextChannelMessageCount.toLocaleString("en") + " messages",
  );

  const mostActiveVoiceChannelString = args.mostActiveVoice?.channelId
    ? `<#${args.mostActiveVoice.channelId}> ${codeString(
        args.mostActiveVoice?.sum.toLocaleString("en") + " hours",
      )}`
    : "";

  const lookbackVoiceSumString = codeString(
    args.lookbackVoiceSum.toLocaleString("en") + " hours",
  );
  const oneDayVoiceSumString = codeString(
    args.oneDayVoiceSum.toLocaleString("en") + " hours",
  );
  const sevenDaysVoiceSumString = codeString(
    args.sevenDayVoiceSum.toLocaleString("en") + " hours",
  );

  const joinedAtUnix = dayjs(args.joinedAt).unix();
  const createdAtUnix = dayjs(args.createdAt).unix();
  const lastMessageUnix = args.lastMessageAt && dayjs(args.lastMessageAt).unix();
  const lastVoiceUnix = args.lastVoiceAt && dayjs(args.lastVoiceAt).unix();
  const lastMessageString = lastMessageUnix
    ? `__<t:${lastMessageUnix}:D>__ (<t:${lastMessageUnix}:R>)`
    : codeString("None");

  const lastVoiceString = lastVoiceUnix
    ? `__<t:${lastVoiceUnix}:D>__ (<t:${lastVoiceUnix}:R>)`
    : codeString("None");

  return {
    color: RED_COLOR,
    title: `👤 ${args.userGlobalName}'s Stats Overview`,

    description: `
${args.userServerName} (${args.userGlobalName})

User stats in the past __${args.lookback}__ Days. (Change with the ${lookbackCommand} command.)

**User Info**
Joined On: __<t:${joinedAtUnix}:D>__ (<t:${joinedAtUnix}:R>)
Created On: __<t:${createdAtUnix}:D>__ (<t:${createdAtUnix}:R>)
Last Message On: ${lastMessageString}
Last Voice On: ${lastVoiceString}
User ID: ${codeString(args.id)}

**Most Active Channels**
Messages: ${mostActiveTextChannelString} ${mostActiveTextChannelCountString}
Voice: ${mostActiveVoiceChannelString}

**Help Stats**
Helped people ${codeString(args.helpCount.toLocaleString("en"))} times.
Received help ${codeString(args.helpReceivedCount.toLocaleString("en"))} times.
`,

    fields: [
      {
        name: "Messages",
        value: `
__${args.lookback} Days__: ${codeString(
          `${args.lookbackDaysCount.toLocaleString("en")} messages`,
        )} 
7 Days: ${codeString(`${args.sevenDaysCount.toLocaleString("en")} messages`)}
24 Hours: ${codeString(`${args.oneDayCount.toLocaleString("en")} messages`)}
`,

        inline: true,
      },
      {
        name: "Voice",
        value: `
__${args.lookback} Days__: ${lookbackVoiceSumString}
7 Days: ${sevenDaysVoiceSumString}
24 Hours: ${oneDayVoiceSumString}
`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};
