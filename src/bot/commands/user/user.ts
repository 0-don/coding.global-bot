import {
  ApplicationCommandOptionType,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeUserStatsCommand } from "@/core/handlers/command-handlers/user/user.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { prisma } from "@/prisma";

@Discord()
export class UserCommand {
  @Slash({
    name: "user",
    description: "Get stats from specific user",
    dmPermission: false,
  })
  async user(
    @SlashOption({
      name: "user",
      description: "Select user which stats should be shown",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    if (!(await safeDeferReply(interaction))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "user",
          },
        })
        .catch(() => {});
    }

    const result = await executeUserStatsCommand(interaction, user.id);

    if ("error" in result) {
      await safeEditReply(interaction, result.error);
      return;
    }

    await safeEditReply(interaction, {
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
