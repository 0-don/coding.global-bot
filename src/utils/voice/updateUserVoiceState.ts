import type { VoiceState } from 'discord.js';
import { prisma } from '../../prisma.js';

export const updateUserVoiceState = async (newVoiceState: VoiceState) => {
  if (!newVoiceState.channel) return;

  await prisma.memberGuild.update({
    where: {
      member_guild: {
        guildId: newVoiceState.guild.id,
        memberId: newVoiceState.member!.id,
      },
    },
    data: {
      deafened: newVoiceState.deaf || false,
      muted: newVoiceState.mute || false,
    },
  });
};
