import { SlashCommandBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { CacheType, CommandInteraction } from 'discord.js';
import { MUTE } from '../utils/constants';

const prisma = new PrismaClient();

export default {
  data: new SlashCommandBuilder()
    .setName('mute-today')
    .setDescription('Mute all that joined today')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction: CommandInteraction<CacheType>) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName },
      update: { guildName },
    });

    const MUTEROLE = interaction.guild?.roles.cache.find(
      ({ name }) => name === MUTE
    );

    if (!MUTEROLE) {
      return await interaction.reply({
        content: `Mute role not found. Please create a role called ${MUTE}`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // let i = 1;
    const members = (await interaction.guild.members.fetch()).filter(
      (member) => member.joinedAt?.getDate() === new Date().getDate()
    );

    interaction.editReply({
      content: `updating user count:${members.size}`,
    });
    return;
    // // loop over all guild members
    // for (let [_, member] of members) {
    //   // refetch user if some roles were reasinged

    //   if (i % Math.floor((members.size / 100) * 10) === 0) {
    //     await interaction.editReply(
    //       `Members: ${i}/${members.size} ${member.user.username}`
    //     );
    //   }

    //   log(`${i}/${members.size} user: ${member.user.username}`);
    //   i++;

    //   const memberRole = member.roles.cache.find((role) => role.name === MUTE);

    //   if (memberRole) continue;

    //   await member.roles.add(MUTEROLE);
    // }
    // return interaction.channel?.send({
    //   content: `Verified all users in ${interaction.guild.name}`,
    // });
  },
};
