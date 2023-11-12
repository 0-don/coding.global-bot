import dayjs from "dayjs";
import { APIEmbed } from "discord.js";
import { ToptatsExampleEmbed, UserStatsExampleEmbed } from "../types/index.js";
import { BOT_ICON, RED_COLOR, STATS_TEMPLATE, TOP_STATS_TEMPLATE } from "./constants.js";
import { codeString, placementSuffix } from "./helpers.js";

export const simpleEmbedExample: APIEmbed = {
  color: RED_COLOR,
  description: `*`,
  timestamp: new Date().toISOString(),
  footer: {
    text: "*",
    icon_url: BOT_ICON,
  },
};

export const topStatsExampleEmbed = ({
  mostActiveMessageUsers,
  mostActiveMessageChannels,
  mostHelpfulUsers,
  mostActiveVoiceUsers,
  mostActiveVoiceChannels,
}: ToptatsExampleEmbed): APIEmbed => {
  const mostActiveVoiceUserSumString = codeString(
    mostActiveVoiceUsers.reduce((acc, { sum }) => acc + sum, 0).toLocaleString("en") + " hours",
  );

  const mostActiveVoiceUsersString = mostActiveVoiceUsers?.map(
    ({ memberId, sum, username }, i) =>
      `${codeString(placementSuffix(i + 1))} <@${memberId}>: (${username}) ${codeString(
        sum.toLocaleString("en") + " hours",
      )}`,
  );

  const mostActiveVoiceChannelSumString = codeString(
    mostActiveVoiceChannels.reduce((a, b) => a + b.sum, 0).toLocaleString("en") + " hours",
  );

  const mostActiveVoiceChannelString = mostActiveVoiceChannels.map(
    ({ sum, channelId }, i) =>
      `${codeString(placementSuffix(i + 1))} <#${channelId}>: ${codeString(sum.toLocaleString("en") + " hours")}`,
  );

  const mostActiveMessageUsersSumString = codeString(
    mostActiveMessageUsers.reduce((a, b) => a + Number(b.count), 0).toLocaleString("en") + " messages",
  );

  const mostHelpfulUsersString = mostHelpfulUsers.map(
    ({ count, memberId, username }, i) =>
      `${codeString(placementSuffix(i + 1))} <@${memberId}>: (${username}) ${codeString(
        count.toLocaleString("en") + " messages",
      )}`,
  );

  const mostActiveMessageUsersString = mostActiveMessageUsers.map(
    ({ count, memberId, username }, i) =>
      `${codeString(placementSuffix(i + 1))} <@${memberId}>: (${username}) ${codeString(
        "messaged " + count.toLocaleString("en") + " times",
      )}`,
  );

  const mostActiveMessageChannelSumString = codeString(
    mostActiveMessageChannels.reduce((a, b) => a + Number(b.count), 0).toLocaleString("en") + " messages",
  );

  const mostActiveMessageChannelString = mostActiveMessageChannels.map(
    ({ count, channelId }, i) =>
      `${codeString(placementSuffix(i + 1))} <#${channelId}>: ${codeString(
        Number(count).toLocaleString("en") + " messages",
      )}`,
  );

  return {
    color: RED_COLOR,
    title: `⭐ Top Stats Overview`,

    description: `
Top users and channels in the past __9,999 Days__.

**Help | Top ${mostHelpfulUsers?.length ?? 0} - Helpers**
Top Helper Sum: 

${mostHelpfulUsersString.join("\n")}

**Messages | Top ${mostActiveMessageUsers?.length ?? 0} - Members**
Top Member Sum: ${mostActiveMessageUsersSumString} 

${mostActiveMessageUsersString.join("\n")}

Messages | Top ${mostActiveMessageChannels?.length ?? 0} - Channels
Top Channel Sum: ${mostActiveMessageChannelSumString}

${mostActiveMessageChannelString.join("\n")}

**Voice | Top ${mostActiveVoiceUsers?.length ?? 0} - Members**
Top Member Sum: ${mostActiveVoiceUserSumString} 

${mostActiveVoiceUsersString.join("\n")}

Voice | Top ${mostActiveVoiceChannels?.length ?? 0} - Channels
Top Channel Sum: ${mostActiveVoiceChannelSumString}

${mostActiveVoiceChannelString.join("\n")}

`,
    timestamp: new Date().toISOString(),
    footer: {
      text: TOP_STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};

export const userStatsExampleEmbed = ({
  id,
  userGlobalName,
  userServerName,
  lookback,
  helpCount,
  helpReceivedCount,
  joinedAt,
  createdAt,
  lookbackDaysCount,
  sevenDaysCount,
  oneDayCount,
  mostActiveTextChannelId,
  mostActiveTextChannelMessageCount,
  lastMessage,
  lastVoice,
  mostActiveVoice,
  lookbackVoiceSum,
  oneDayVoiceSum,
  sevenDayVoiceSum,
}: UserStatsExampleEmbed): APIEmbed => {
  const lookbackCommand = codeString("/lookback-me");
  const mostActiveTextChannelString = mostActiveTextChannelId ? `<#${mostActiveTextChannelId}>` : "";
  const mostActiveTextChannelCountString = codeString(
    mostActiveTextChannelMessageCount.toLocaleString("en") + " messages",
  );

  const mostActiveVoiceChannelString = mostActiveVoice?.channelId
    ? `<#${mostActiveVoice.channelId}> ${codeString(mostActiveVoice?.sum.toLocaleString("en") + " hours")}`
    : "";

  const lookbackVoiceSumString = codeString(lookbackVoiceSum.toLocaleString("en") + " hours");
  const oneDayVoiceSumString = codeString(oneDayVoiceSum.toLocaleString("en") + " hours");
  const sevenDaysVoiceSumString = codeString(sevenDayVoiceSum.toLocaleString("en") + " hours");

  const joinedAtUnix = dayjs(joinedAt).unix();
  const createdAtUnix = dayjs(createdAt).unix();
  const lastMessageUnix = lastMessage?.length > 0 && dayjs(lastMessage[0]!.createdAt).unix();
  const lastVoiceUnix = lastVoice?.length > 0 && dayjs(lastVoice?.[0]?.leave ?? new Date()).unix();
  const lastMessageString = lastMessageUnix
    ? `__<t:${lastMessageUnix}:D>__ (<t:${lastMessageUnix}:R>)`
    : codeString("None");

  const lastVoiceString = lastVoiceUnix ? `__<t:${lastVoiceUnix}:D>__ (<t:${lastVoiceUnix}:R>)` : codeString("None");

  return {
    color: RED_COLOR,
    title: `👤 ${userGlobalName}'s Stats Overview`,

    description: `
${userServerName} (${userGlobalName})

User stats in the past __${lookback}__ Days. (Change with the ${lookbackCommand} command.)

**User Info**
Joined On: __<t:${joinedAtUnix}:D>__ (<t:${joinedAtUnix}:R>)
Created On: __<t:${createdAtUnix}:D>__ (<t:${createdAtUnix}:R>)
Last Message On: ${lastMessageString}
Last Voice On: ${lastVoiceString}
User ID: ${codeString(id)}

**Most Active Channels**
Messages: ${mostActiveTextChannelString} ${mostActiveTextChannelCountString}
Voice: ${mostActiveVoiceChannelString}

**Help Stats**
Helped people ${codeString(helpCount.toLocaleString("en"))} times.
Received help ${codeString(helpReceivedCount.toLocaleString("en"))} times.
`,

    fields: [
      {
        name: "Messages",
        value: `
__${lookback} Days__: ${codeString(`${lookbackDaysCount.toLocaleString("en")} messages`)} 
7 Days: ${codeString(`${sevenDaysCount.toLocaleString("en")} messages`)}
24 Hours: ${codeString(`${oneDayCount.toLocaleString("en")} messages`)}
`,

        inline: true,
      },
      {
        name: "Voice",
        value: `
__${lookback} Days__: ${lookbackVoiceSumString}
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
