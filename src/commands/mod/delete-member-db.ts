import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service.js";
import { prisma } from "../../prisma.js";

@Discord()
export class DeleteMemberDb {
  @Slash({
    name: "delete-member-db",
    description: "delete specific member from database",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async deleteMemberDb(
    @SlashOption({
      name: "user",
      description: "select user",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction
  ) {
    // get member from slash command input

    LogService.logCommandHistory(interaction, "delete-member-db");
    try {
      // try to delete member from database if it exists
      await prisma.member.delete({ where: { memberId: user?.id } });
    } catch (_) {
      // if member doesn't exist, return
      return await interaction.reply("user not found");
    }

    // confirm deletion
    return await interaction.reply({
      flags: [MessageFlags.Ephemeral],
      content: "user data deleted",
    });
  }
}
