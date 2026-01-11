import {
  ChannelType,
  Guild,
  GuildMember,
  User,
  VoiceChannel,
} from "discord.js";
import { moveMemberToChannel } from "@/core/services/members/move-member-to-channel";
import { prisma } from "@/prisma";

const BOT_OWNER_ID = "1302775229923332119";

export async function executeTrollMoveUser(
  user: User,
  count: number,
  timeout: number,
  executorId: string,
  guild: Guild,
): Promise<string> {
  if (user.id === BOT_OWNER_ID && executorId !== BOT_OWNER_ID) {
    return "You can't troll me";
  }

  if (executorId === user.id && user.id !== BOT_OWNER_ID) {
    return "You can't troll yourself";
  }

  await prisma.memberGuild.update({
    where: {
      member_guild: {
        guildId: guild.id,
        memberId: user.id,
      },
    },
    data: { moveCounter: count, moveTimeout: timeout },
  });

  const allVoiceChannels = (await guild.channels.fetch()).filter(
    (c) => c?.type === ChannelType.GuildVoice,
  );

  for (const [, channel] of allVoiceChannels) {
    const voiceChannel = channel as VoiceChannel;
    try {
      await voiceChannel.permissionOverwrites.delete(user.id);
    } catch (_) {}
  }

  const guildMember = (await guild.members.fetch(user.id)) as GuildMember;

  if (count > 0) moveMemberToChannel(guildMember);

  return "Trolling begins";
}
