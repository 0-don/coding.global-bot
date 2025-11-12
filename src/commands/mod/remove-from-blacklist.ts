import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { prisma } from "../../prisma";


@Discord()
export class RemoveFromBlackList {
  @Slash({
    name: "remove-from-blacklist",
    description: `Add a user to bot's blacklist`,
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async addToBlacklist(
    @SlashOption({
      name: "user_id",
      description: "user ID",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    userId: string,
    interaction: CommandInteraction
  ) {
    // LogService.logCommandHistory(interaction, "add-to-blacklist");


    const existingEntry = await prisma.backList.findUnique({
      where: {
        userID: userId,
      },
    });

    if (existingEntry) {
      return await interaction.reply({
        content: `The user with ID \`${userId}\` is already blacklisted.`,
        ephemeral: true,
      });
    }

    await prisma.backList.delete({
      where: {
        userID: userId,  
      },
    });

    await interaction.reply({
      content: `Successfully added user with ID \`${userId}\` to the blacklist.`,
      ephemeral: true,
    });
  }
}