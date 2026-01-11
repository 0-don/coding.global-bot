import { executeDeleteMemberDb } from "@/core/handlers/command-handlers/mod/delete-member-db.handler";
import { prisma } from "@/prisma";
import type { CommandInteraction, User } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

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
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "delete-member-db",
          },
        })
        .catch(() => {});
    }

    const result = await executeDeleteMemberDb(interaction, user.id);

    return interaction.reply({
      flags: [MessageFlags.Ephemeral],
      content: result.message,
    });
  }
}
