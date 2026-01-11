import { MoveMemberToChannelService } from "@/core/services/members/move-member-to-channel.service";
import { prisma } from "@/prisma";
import { BOT_OWNER_ID } from "@/shared/config/roles";
import type { CommandInteraction, User } from "discord.js";
import { ChannelType, VoiceChannel } from "discord.js";

export async function executeTrollMoveUser(
  interaction: CommandInteraction,
  user: User,
  count: number,
  timeout: number,
): Promise<string> {
  if (!interaction.guild) {
    return "This command can only be used in a server";
  }

  if (user.id === BOT_OWNER_ID && interaction.user.id !== BOT_OWNER_ID) {
    return "You can't troll me";
  }

  if (interaction.user.id === user.id && user.id !== BOT_OWNER_ID) {
    return "You can't troll yourself";
  }

  await prisma.memberGuild.update({
    where: {
      member_guild: {
        guildId: interaction.guild.id,
        memberId: user.id,
      },
    },
    data: { moveCounter: count, moveTimeout: timeout },
  });

  const allVoiceChannels = interaction.guild.channels.cache.filter(
    (c) => c?.type === ChannelType.GuildVoice,
  );

  for (const [, channel] of allVoiceChannels) {
    const voiceChannel = channel as VoiceChannel;
    try {
      await voiceChannel.permissionOverwrites.delete(user.id);
    } catch (_) {}
  }

  const guildMember =
    interaction.guild.members.cache.get(user.id) ??
    (await interaction.guild.members.fetch(user.id));

  if (count > 0) MoveMemberToChannelService.moveMemberToChannel(guildMember);

  return "Trolling begins";
}
