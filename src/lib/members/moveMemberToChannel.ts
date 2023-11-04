import { ChannelType, GuildMember, VoiceChannel } from "discord.js";
import { prisma } from "../../prisma.js";

export const moveMemberToChannel = async (member: GuildMember): Promise<void> => {
  let guildMemberDb = await prisma.memberGuild.findFirst({
    where: {
      guildId: member.guild.id,
      memberId: member.id,
    },
  });

  let count = guildMemberDb?.moveCounter || 0;

  if (!guildMemberDb || count === 0) return;

  let guildMember = await member.guild.members.fetch(member.id);
  const allVoiceChannels = (await member.guild.channels.fetch()).filter((c) => c?.type === ChannelType.GuildVoice);

  const voiceChannelsWithUsers = allVoiceChannels.filter((c) => c && c?.members.size > 0);

  const voiceChannelsWithoutUsers = allVoiceChannels.filter((c) => c && c?.members.size === 0);

  for (const [id, channel] of voiceChannelsWithoutUsers) {
    const voiceChannel = channel as VoiceChannel;
    try {
      await voiceChannel.permissionOverwrites.delete(member.id);
    } catch (_) {}
  }

  const voiceChannels = allVoiceChannels.filter(
    (c) => c && c?.members.size === 0 && guildMember.permissionsIn(c).has("Connect"),
  );

  for (const [id, channel] of voiceChannelsWithUsers) {
    const voiceChannel = channel as VoiceChannel;
    await voiceChannel.permissionOverwrites.edit(member.id, { Connect: false });
  }

  while (true) {
    guildMember = await member.guild.members.fetch(member.id);
    const randomChannel = voiceChannels.random() as VoiceChannel;
    await randomChannel?.fetch();

    if (
      randomChannel?.id !== guildMember.voice.channelId &&
      randomChannel?.members.size === 0 &&
      guildMember.permissionsIn(randomChannel).has("Connect")
    ) {
      try {
        await guildMember.voice.setChannel(randomChannel);
        guildMemberDb = await prisma.memberGuild.update({
          where: { id: guildMemberDb?.id },
          data: { moveCounter: count - 1, moving: true },
        });

        count = guildMemberDb.moveCounter;
      } catch (_) {
        await exit();
        break;
      }
    }

    if (count <= 0) {
      await exit();
      break;
    }
  }

  async function exit() {
    await prisma.memberGuild.update({
      where: { id: guildMemberDb?.id },
      data: { moving: false },
    });
    setTimeout(
      async () => {
        for (const [id, channel] of allVoiceChannels) {
          const voiceChannel = channel as VoiceChannel;
          try {
            await voiceChannel.permissionOverwrites.delete(member.id);
          } catch (_) {}
        }
      },
      (guildMemberDb?.moveTimeout || 0) * 1000,
    );
  }
};
