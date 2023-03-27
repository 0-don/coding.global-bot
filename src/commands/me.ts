import { SlashCommandBuilder } from '@discordjs/builders';
import type { CacheType,CommandInteraction,TextChannel } from 'discord.js';
import { BOT_CHANNEL } from '../utils/constants.js';
import { userStatsEmbed } from '../utils/stats/userStatsEmbed.js';


export default {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Get your stats'),
  async execute(interaction: CommandInteraction<CacheType>) {
    // get text channel
    console.log(1);

    // deferReply if it takes longer then usual
    // await interaction.deferReply();
    
    const channel = (await interaction.channel?.fetch()) as TextChannel;
    console.log(2);

    console.log(3);
    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL)
      return interaction.editReply(
        'Please use this command in the bot channel'
      );
    console.log(4);
    const embed = await userStatsEmbed(interaction);
    console.log(5);
    if (typeof embed === 'string') return interaction.reply(embed);
    console.log(6);
    // return embed with chart img
    return interaction.reply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  },
};
