import {
  ApplicationCommandOptionType,
  ChannelType,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  User,
  VoiceChannel,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { moveMemberToChannel } from "../../lib/members/move-member-to-channel";
import { prisma } from "../../prisma";

@Discord()
export class TrollMoveUser {
  @Slash({
    name: "troll-move-user",
    description: "troll move user around empty voice channels",
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
    dmPermission: false,
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
      description:
        "How many times should the user be moved, to disable set to 0",
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
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    LogService.logCommandHistory(interaction, "troll-move-user");

    if (
      user.id === "1302775229923332119" &&
      interaction.user.id !== "1302775229923332119"
    )
      return interaction.editReply(`You can't troll me`);

    if (interaction.user.id === user.id && user.id !== "1302775229923332119")
      return interaction.editReply(`You can't troll yourself`);

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

    const guildMember = (await interaction.guild?.members.fetch(
      user.id,
    )) as GuildMember;

    if (count > 0) moveMemberToChannel(guildMember);

    // send success message
    return await interaction.editReply(`Trolling begins`);
  }
}
