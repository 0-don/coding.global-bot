// WHY?
// Well, i want that the bot ignore u.

import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { prisma } from "../../prisma";

@Discord()
export class AddToBlacklist {
  @Slash({
    name: "add-to-blacklist",
    description: `Add a user to bot's blacklist`,
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async addToBlacklist(
    @SlashOption({
      name: "user_id",
      description: "ID to add to blacklist",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    userId: string,
    interaction: CommandInteraction
  ) {
    // LogService.logCommandHistory(interaction, "add-to-blacklist");


    const existingEntry = await prisma.backList.findFirst({
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

    await prisma.backList.create({
      data: {
        userID: userId,
       AddedBy: interaction.user.id,
        AddedAt: ''
      },
    });

    await interaction.reply({
      content: `Successfully added user with ID \`${userId}\` to the blacklist.`,
      ephemeral: true,
    });
  }
}
