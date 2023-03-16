import {
  ChannelType,
  GuildMember,
  PermissionsBitField,
  VoiceChannel,
} from 'discord.js';
import { prisma } from '../../prisma.js';

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

  let guildMember = await member.guild.members.fetch(member.id);
  const allVoiceChannels = (await member.guild.channels.fetch()).filter(
    (c) => c?.type === ChannelType.GuildVoice
  );

  const voiceChannelsWithUsers = allVoiceChannels.filter(
    (c) => c && c?.members.size > 0
  );

  const voiceChannels = allVoiceChannels.filter(
    (c) =>
      c && c?.members.size === 0 && guildMember.permissionsIn(c).has('Connect')
  );

  for (const [id, channel] of voiceChannelsWithUsers) {
    const voiceChannel = channel as VoiceChannel;
    await voiceChannel.permissionOverwrites.set([
      {
        channel: voiceChannel,
        id: member.id,
        deny: [PermissionsBitField.Flags.Connect],
      },
    ]);
  }

  while (true) {
    guildMember = await member.guild.members.fetch(member.id);
    const randomChannel = voiceChannels.random() as VoiceChannel;
    await randomChannel.fetch();

    if (
      randomChannel?.id !== guildMember.voice.channelId &&
      randomChannel?.members.size === 0 &&
      guildMember.permissionsIn(randomChannel).has('Connect')
    ) {
      try {
        await guildMember.voice.setChannel(randomChannel);
        guildMemberDb = await prisma.memberGuild.update({
          where: { id: guildMemberDb?.id },
          data: { moveCounter: count - 1, moving: true },
        });

        count = guildMemberDb.moveCounter;
      } catch (_) {
        await prisma.memberGuild.update({
          where: { id: guildMemberDb?.id },
          data: { moving: false },
        });
        setTimeout(async () => {
          for (const [id, channel] of allVoiceChannels) {
            const voiceChannel = channel as VoiceChannel;
            try {
              await voiceChannel.permissionOverwrites.delete(member.id);
            } catch (_) {}
          }
        }, 2500);
        break;
      }
    }

    if (count <= 0) {
      await prisma.memberGuild.update({
        where: { id: guildMemberDb?.id },
        data: { moving: false },
      });
      setTimeout(async () => {
        for (const [id, channel] of allVoiceChannels) {
          const voiceChannel = channel as VoiceChannel;
          try {
            await voiceChannel.permissionOverwrites.delete(member.id);
          } catch (_) {}
        }
      }, 2500);
      break;
    }
  }
};
