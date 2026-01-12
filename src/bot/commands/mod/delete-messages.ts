import { executeDeleteMessages } from "@/core/handlers/command-handlers/mod/delete-messages.handler";
import { safeDeferReply } from "@/core/utils/command.utils";
import { prisma } from "@/prisma";
import type { CommandInteraction } from "discord.js";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class DeleteMessages {
  @Slash({
    name: "delete-messages",
    description: "Deletes messages from a channel",
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    dmPermission: false,
  })
  async deleteMessages(
    @SlashOption({
      name: "amount",
      description: "Delete message amount",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 1000,
    })
    amount: number,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] }))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "delete-messages",
          },
        })
        .catch(() => {});
    }

    const result = await executeDeleteMessages(interaction, amount);

    if (result.error) return interaction.editReply(result.error);

    return interaction.editReply({ content: "messages are deleted" });
  }
}
