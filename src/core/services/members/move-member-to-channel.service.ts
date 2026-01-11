import { ChannelType, GuildMember, VoiceChannel } from "discord.js";
import { prisma } from "@/prisma";

export class MoveMemberToChannelService {
  static async moveMemberToChannel(member: GuildMember): Promise<void> {
    let guildMemberDb = await prisma.memberGuild.findFirst({
      where: {
        guildId: member.guild.id,
        memberId: member.id,
      },
    });

    let count = guildMemberDb?.moveCounter || 0;

    if (!guildMemberDb || count === 0) return;

    let guildMember = member;
    const allVoiceChannels = member.guild.channels.cache.filter(
      (c) => c?.type === ChannelType.GuildVoice,
    );

    const voiceChannelsWithUsers = allVoiceChannels.filter(
      (c) => c && c?.members.size > 0,
    );

    const voiceChannelsWithoutUsers = allVoiceChannels.filter(
      (c) => c && c?.members.size === 0,
    );

    for (const [id, channel] of voiceChannelsWithoutUsers) {
      const voiceChannel = channel as VoiceChannel;
      try {
        await voiceChannel.permissionOverwrites.delete(member.id);
      } catch (_) {}
    }

    const voiceChannels = allVoiceChannels.filter(
      (c) =>
        c && c?.members.size === 0 && guildMember.permissionsIn(c).has("Connect"),
    );

    for (const [id, channel] of voiceChannelsWithUsers) {
      const voiceChannel = channel as VoiceChannel;
      await voiceChannel.permissionOverwrites.edit(member.id, { Connect: false });
    }

    const exit = async () => {
      await prisma.memberGuild.update({
        where: { id: guildMemberDb?.id },
        data: { moving: false },
      });

      // Only unlock empty channels immediately
      setTimeout(
        async () => {
          for (const [id, channel] of voiceChannelsWithoutUsers) {
            const voiceChannel = channel as VoiceChannel;
            try {
              await voiceChannel.permissionOverwrites.delete(member.id);
            } catch (_) {}
          }
        },
        (guildMemberDb?.moveTimeout || 0) * 1000,
      );
    };

    while (true) {
      guildMember = await member.guild.members.fetch(member.id);

      // Check if user left voice channel
      if (!guildMember.voice.channelId) {
        await exit();

        // Unlock channels with users after 1 minute
        setTimeout(async () => {
          for (const [id, channel] of voiceChannelsWithUsers) {
            const voiceChannel = channel as VoiceChannel;
            try {
              await voiceChannel.permissionOverwrites.delete(member.id);
            } catch (_) {}
          }
        }, 60000); // 1 minute

        break;
      }

      const randomChannel = voiceChannels.random() as VoiceChannel;

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
  }
}
