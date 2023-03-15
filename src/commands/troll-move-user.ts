import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type {
  CacheType,
  CommandInteraction,
  GuildMember,
  User,
} from 'discord.js';
import { prisma } from '../prisma.js';
import { moveMemberToChannel } from '../utils/members/moveMemberToChannel.js';

export default {
  data: new SlashCommandBuilder()
    .setName('troll-move-user')
    .setDescription('troll move user around empty voice channels')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Select either user which should be moved')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription(
          'How many times should the user be moved, to disable set to 0'
        )
        .setMinValue(0)
        .setMaxValue(9999)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    const user = interaction.options.getUser('user') as User;

    const count = interaction.options.get('count')?.value as number;
    await interaction.deferReply({ ephemeral: true });

    if (interaction.user.id === user.id)
      return interaction.editReply(`You can't troll yourself`);

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          guildId: interaction.guildId as string,
          memberId: user.id,
        },
      },
      data: { moveCounter: count },
    });

    const guildMember = (await interaction.guild?.members.fetch(
      user.id
    )) as GuildMember;

    if (count > 0) moveMemberToChannel(guildMember);

    // send success message
    return interaction.editReply(`Trolling begins`);
  },
};
