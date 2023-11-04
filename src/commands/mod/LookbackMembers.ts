import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { prisma } from "../../prisma.js";

@Discord()
export class LookbackMembers {
  @Slash({
    name: "lookback-members",
    description: "Change lookback date range for guild",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async lookbackMembers(
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
    const guildName = interaction.guild?.name;

    if (!guildId || !guildName) return await interaction.reply("Please use this command in a server");

    // create or update guild
    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName, lookback },
      update: { guildName, lookback },
    });

    // send success message
    return await interaction.reply(`Lookback set to ${lookback} days for ${guildName}`);
  }
}
