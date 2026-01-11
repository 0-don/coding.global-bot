import dayjs from "dayjs";
import { APIEmbed } from "discord.js";
import { UserStatsExampleEmbed } from "@/types";
import { BOT_ICON, RED_COLOR, STATS_TEMPLATE } from "@/shared/config/branding";
import { codeString } from "@/shared/utils/format.utils";

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
  const lastMessageUnix =
    args.lastMessageAt && dayjs(args.lastMessageAt).unix();
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
