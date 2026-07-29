import type { CommandInteraction, User } from "discord.js";

export const MAX_MUTE_MS = 28 * 24 * 60 * 60 * 1000;

export interface MuteResult {
	success: true;
	mutedUser: User;
	mutedBy: User;
	days: number;
	hours: number;
	minutes: number;
	reason: string;
}

export async function executeMute(
	interaction: CommandInteraction,
	targetUser: User,
	days: number,
	hours: number,
	minutes: number,
	reason: string | undefined,
): Promise<string | MuteResult> {
	const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;

	if (totalMs <= 0) {
		return "Duration must be more than 0 minutes.";
	}

	if (totalMs > MAX_MUTE_MS) {
		return "28 days is the maximum mute duration.";
	}

	const member =
		interaction.guild?.members.cache.get(targetUser.id) ??
		(await interaction.guild?.members
			.fetch(targetUser.id)
			.catch(() => null));

	if (!member) return "User not found in this server.";

	try {
		await member.disableCommunicationUntil(
			new Date(Date.now() + totalMs),
		);
	} catch {
		return "I can't mute someone with a higher role than me.";
	}

	return {
		success: true,
		mutedUser: targetUser,
		mutedBy: interaction.user,
		days,
		hours,
		minutes,
		reason: reason || "No reason provided",
	};
}
