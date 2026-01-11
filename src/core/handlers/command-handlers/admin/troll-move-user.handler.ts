import type { CommandInteraction, User } from "discord.js";
import { ChannelType, GuildMember, VoiceChannel } from "discord.js";
import { moveMemberToChannel } from "@/core/services/members/move-member-to-channel";
import { prisma } from "@/prisma";
import { BOT_OWNER_ID } from "@/shared/config/roles";

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

  const allVoiceChannels = (await interaction.guild.channels.fetch()).filter(
    (c) => c?.type === ChannelType.GuildVoice,
  );

  for (const [, channel] of allVoiceChannels) {
    const voiceChannel = channel as VoiceChannel;
    try {
      await voiceChannel.permissionOverwrites.delete(user.id);
    } catch (_) {}
  }

  const guildMember = (await interaction.guild.members.fetch(
    user.id,
  )) as GuildMember;

  if (count > 0) moveMemberToChannel(guildMember);

  return "Trolling begins";
}
