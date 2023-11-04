import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { prisma } from "../../prisma.js";

@Discord()
export class LookbackMe {
  @Slash({
    name: "lookback-me",
    description: "Change lookback date range for yourself",
  })
  async lookbackMe(
    @SlashOption({
      name: "lookback",
      description: "Set lookback days range",
      required: true,
      minValue: 3,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    lookback: number,
    interaction: CommandInteraction,
  ) {
    // get guild data
    const guildId = interaction.guild?.id;
    const memberId = interaction.member?.user.id;

    if (!guildId || !memberId) return await interaction.reply("Please use this command in a server");

    // create or update guild
    await prisma.memberGuild.upsert({
      where: { member_guild: { guildId, memberId } },
      create: { guildId, lookback, memberId, status: true },
      update: { guildId, lookback, memberId, status: true },
    });

    // send success message
    return await interaction.reply(`Lookback set to ${lookback} days for ${interaction.member?.user.username}`);
  }
}
