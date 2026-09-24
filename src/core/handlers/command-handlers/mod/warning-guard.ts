import type { Guild } from "discord.js";

/**
 * Whether this moderator may change a warning about this member.
 *
 * /delete-warning and /edit-warning are gated on Manage Roles only, so without
 * this a moderator could quietly clear their own record, or one an admin gave
 * a colleague above them - the same rank rule /warn applies to issuing one.
 *
 * Returns the refusal to show, or null when the change may proceed.
 */
export async function refuseWarningChange(
  guild: Guild,
  invokerId: string,
  targetId: string,
): Promise<string | null> {
  if (invokerId === targetId) return "You can't change your own warnings.";

  if (invokerId === guild.ownerId) return null;

  const target = await guild.members.fetch(targetId).catch(() => null);

  // Not in the server: there are no roles to weigh.
  if (!target) return null;

  const invoker = await guild.members.fetch(invokerId).catch(() => null);
  if (!invoker)
    return "I could not check your roles, so I have not changed anything.";

  if (target.roles.highest.position >= invoker.roles.highest.position) {
    return "You can't change warnings for someone whose highest role is equal to or above yours.";
  }

  return null;
}
