import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { deletedMessagesEmbed } from "../../lib/embeds.js";
import { prisma } from "../../prisma.js";

@Discord()
export class LogDeletedMessages {
  @Slash({
    name: "log-deleted-messages",
    description: "Show deleted messages",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async logDeletedMessages(
    @SlashOption({
      name: "count",
      description: "Amount of messages to show",
      type: ApplicationCommandOptionType.String,
    })
    count: string,
    interaction: CommandInteraction
  ) {
    const c = count ? Number(count) : 10;
    const guildId = interaction.guild?.id;

    await interaction.deferReply();

    const messages = await prisma.memberDeletedMessages.findMany({
      where: { guildId },
      take: c,
      orderBy: { createdAt: "desc" },
    });

    const embed = deletedMessagesEmbed(messages);

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
