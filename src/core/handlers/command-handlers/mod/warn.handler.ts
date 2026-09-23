import { WarningsService } from "@/core/services/moderation/warnings.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { MessageResult } from "@/types";
import type { CommandInteraction, User } from "discord.js";

export async function executeWarn(
  interaction: CommandInteraction,
  target: User,
  reason: string,
): Promise<MessageResult> {
  if (!interaction.guild) {
    return { error: "This command can only be used in a server" };
  }

  if (target.bot) {
    return { error: "You can't warn a bot" };
  }

  if (target.id === interaction.user.id) {
    return { error: "You can't warn yourself" };
  }

  if (target.id === interaction.guild.ownerId) {
    return { error: "You can't warn the server owner" };
  }

  // Discord gates this command on ManageRoles, which every moderator has - so
  // without a rank check the newest of them can warn an admin, and at four
  // warnings the automod would try to jail them.
  const [targetMember, invoker] = await Promise.all([
    interaction.guild.members.fetch(target.id).catch(() => null),
    interaction.guild.members.fetch(interaction.user.id).catch(() => null),
  ]);

  if (
    targetMember &&
    invoker &&
    invoker.id !== interaction.guild.ownerId &&
    targetMember.roles.highest.position >= invoker.roles.highest.position
  ) {
    return {
      error: "You can't warn someone whose highest role is above yours",
    };
  }

  const { warning } = await WarningsService.addWarning({
    guildId: interaction.guild.id,
    memberId: target.id,
    username: target.username,
    moderatorId: interaction.member?.user.id,
    moderatorName: interaction.member?.user.username,
    reason,
  });

  await ModLogService.postLog({
    guild: interaction.guild,
    action: "warn",
    targetId: target.id,
    targetName: target.username,
    moderatorId: interaction.member?.user.id,
    moderatorName: interaction.member?.user.username,
    reason,
  });

  try {
    await target.send(
      `You have been warned in **${interaction.guild.name}**: ${reason}`,
    );
  } catch {
    // user has DMs closed or has left - warning is still recorded
  }

  return {
    message: `Warned ${target.username} (warning #${warning.id}): ${reason}`,
  };
}
