import type { APIEmbed, GuildMember, TextChannel } from "discord.js";
import { JOIN_EVENTS_CHANNEL, simpleEmbedExample } from "../constants.js";

export const logJoinLeaveEvents = async (
  member: GuildMember,
  event: "join" | "leave"
) => {
  try {
    // get voice channel by name
    const joinEventsChannel = member.guild.channels.cache.find(
      ({ name }) => name === JOIN_EVENTS_CHANNEL
    );

    // check if voice channel exists and it is voice channel
    if (!joinEventsChannel || !joinEventsChannel.isTextBased()) return;

    const userServerName = member?.user.toString();
    const userGlobalName = member?.user.username;

    // copy paste embed so it doesnt get overwritten
    const joinEmbed = JSON.parse(
      JSON.stringify(simpleEmbedExample)
    ) as APIEmbed;

    // create embed based on event
    joinEmbed.timestamp = new Date().toISOString();

    if (event === "join") {
      joinEmbed.description = `${userServerName} (${userGlobalName}) joined the server ✅`;
      joinEmbed.footer!.text = "join";
    } else {
      joinEmbed.description = `${userServerName} (${userGlobalName}) left the server 🚪`;
      joinEmbed.footer!.text = "leave";
    }

    // send embed event to voice channel
    (joinEventsChannel as TextChannel).send({
      embeds: [joinEmbed],
      allowedMentions: { users: [] },
    });
  } catch (_) {}
};
