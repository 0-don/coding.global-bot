import type { CommandInteraction, GuildMember } from "discord.js";

export const MAX_SELF_MUTE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SelfMuteResult {
	success: true;
	days: number;
	hours: number;
	minutes: number;
}

export async function executeSelfMute(
	interaction: CommandInteraction,
	days: number,
	hours: number,
	minutes: number,
): Promise<string | SelfMuteResult> {
	const member = interaction.member as GuildMember;
	if (!member) return "Could not find your member data.";

	const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;

	if (totalMs <= 0) {
		return "you really love wasting my time, don't you?";
	}

	if (totalMs > MAX_SELF_MUTE_MS) {
		return "7 days is the maximum you can go for self mute";
	}

	await member.disableCommunicationUntil(new Date(Date.now() + totalMs));

	return { success: true, days, hours, minutes };
}
