import { APIEmbed } from "discord.js";
import { ToptatsExampleEmbed } from "@/types";
import {
  BOT_ICON,
  RED_COLOR,
  TOP_STATS_TEMPLATE,
} from "@/shared/config/branding";
import { codeString, placementSuffix } from "@/shared/utils/format.utils";

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
    timestamp: new Date().toISOString(),
    footer: {
      text: TOP_STATS_TEMPLATE,
      icon_url: BOT_ICON,
    },
  };
};
