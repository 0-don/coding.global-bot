import { ChannelType, GuildMember, VoiceChannel } from 'discord.js';
import { prisma } from '../../prisma.js';
import { sleep } from '../helpers.js';

export const moveMemberToChannel = async (
  member: GuildMember
): Promise<void> => {
  let guildMemberDb = await prisma.memberGuild.findFirst({
    where: {
      guildId: member.guild.id,
      memberId: member.id,
    },
  });
  let count = guildMemberDb?.moveCounter || 0;

  if (!guildMemberDb || count === 0) return;

  const voiceChannels = (await member.guild.channels.fetch()).filter(
    (c) => c?.type === ChannelType.GuildVoice
  );

  while (true) {
    const guildMember = await member.guild.members.fetch(member.id);
    const randomChannel = voiceChannels.random() as VoiceChannel;

    await randomChannel.fetch();

    if (
      randomChannel?.id !== guildMember.voice.channelId &&
      randomChannel?.members.size === 0
    ) {
      try {
        await guildMember.voice.setChannel(randomChannel);
        guildMemberDb = await prisma.memberGuild.update({
          where: { id: guildMemberDb?.id },
          data: { moveCounter: count - 1 },
        });

        count = guildMemberDb.moveCounter;
      } catch (_) {

        break;
      }
    }

    if (count <= 0) break;
    await sleep(50);
  }
};
