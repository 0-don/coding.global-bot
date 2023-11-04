import {
  ApplicationCommandOptionType,
  ChannelType,
  GuildMember,
  PermissionFlagsBits,
  User,
  VoiceChannel,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { moveMemberToChannel } from "../../lib/members/moveMemberToChannel.js";
import { prisma } from "../../prisma.js";

@Discord()
export class TrollMoveUser {
  @Slash({
    name: "troll-move-user",
    description: "troll move user around empty voice channels",
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  })
  async trollMoveUser(
    @SlashOption({
      name: "user",
      description: "Select either user which should be moved",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "count",
      description: "How many times should the user be moved, to disable set to 0",
      required: true,
      minValue: 0,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    count: number,
    @SlashOption({
      name: "timeout",
      description: "How long till channel unlock on move (seconds)",
      required: true,
      minValue: 0,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    timeout: number = 0,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: true });

    if (interaction.user.id === user.id) return interaction.editReply(`You can't troll yourself`);

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          guildId: interaction.guildId as string,
          memberId: user.id,
        },
      },
      data: { moveCounter: count, moveTimeout: timeout },
    });

    const allVoiceChannels = (await interaction.guild!.channels.fetch()).filter(
      (c) => c?.type === ChannelType.GuildVoice,
    );

    for (const [id, channel] of allVoiceChannels) {
      const voiceChannel = channel as VoiceChannel;
      try {
        await voiceChannel.permissionOverwrites.delete(user.id);
      } catch (_) {}
    }

    const guildMember = (await interaction.guild?.members.fetch(user.id)) as GuildMember;

    if (count > 0) moveMemberToChannel(guildMember);

    // send success message
    return await interaction.editReply(`Trolling begins`);
  }
}
