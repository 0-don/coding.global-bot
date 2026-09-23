import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { WarningsService } from "@/core/services/moderation/warnings.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { isJailWarning, nextJailWarning } from "@/shared/config/moderation";
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
  // without a rank check the newest of them can warn an admin, and every third
  // warning jails.
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

  const { warning, warningCount } = await WarningsService.addWarning({
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

  // Same threshold as the invite filter, since both feed one count. No message
  // purge here: a warning for rudeness is no reason to wipe two weeks of posts.
  const jailed =
    isJailWarning(warningCount) &&
    !(
      await DeleteUserMessagesService.jailUser({
        guild: interaction.guild,
        memberId: target.id,
        user: target,
        jail: true,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
        reason: `Reached ${warningCount} warnings (latest: ${reason})`,
      })
    ).alreadyJailed;

  try {
    await target.send(
      jailed
        ? `You have been warned in **${interaction.guild.name}**: ${reason}\nThat is ${warningCount} warnings, so you have been jailed. Ask a mod to release you.`
        : `You have been warned in **${interaction.guild.name}**: ${reason}\nWarnings: ${warningCount}, you will be jailed at ${nextJailWarning(warningCount)}.`,
    );
  } catch {
    // user has DMs closed or has left - warning is still recorded
  }

  return {
    message: jailed
      ? `Warned ${target.username} (warning #${warning.id}): ${reason}\nThat is warning ${warningCount}, so they have been jailed.`
      : `Warned ${target.username} (warning #${warning.id}, ${warningCount} total): ${reason}`,
  };
}
