import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "../../lib/logs/log.service";
import { prisma } from "../../prisma";

@Discord()
export class DeleteMemberDb {
  @Slash({
    name: "delete-member-db",
    description: "delete specific member from this server's database",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteMemberDb(
    @SlashOption({
      name: "user",
      description: "select user",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: "This command can only be used in a server",
      });
    }

    LogService.logCommandHistory(interaction, "delete-member-db");

    try {
      // Delete only the guild-specific relationship
      // This will cascade to delete guild-specific data (messages, voice events, etc.)
      await prisma.memberGuild.delete({
        where: {
          member_guild: {
            memberId: user.id,
            guildId: guildId,
          },
        },
      });

      // Check if member has relationships with other guilds
      const otherGuildCount = await prisma.memberGuild.count({
        where: { memberId: user.id },
      });

      // Only delete the global Member record if no other guild relationships exist
      if (otherGuildCount === 0) {
        await prisma.member.delete({
          where: { memberId: user.id },
        });
      }

      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `User data deleted from this server${
          otherGuildCount === 0 ? " (and global profile removed)" : ""
        }`,
      });
    } catch (_) {
      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: "User not found in this server",
      });
    }
  }
}
