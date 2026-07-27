import { executeSelfMute } from "@/core/handlers/command-handlers/user/selfmute.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { BOT_ICON, GREEN_COLOR } from "@/shared/config/branding";
import {
	ApplicationCommandOptionType,
	type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class SelfMuteCommand {
	@Slash({
		name: "selfmute",
		description: "Take a break from Discord",
		dmPermission: false,
	})
	async selfmute(
		@SlashOption({
			name: "days",
			description: "Number of days (max 7)",
			required: false,
			minValue: 0,
			maxValue: 7,
			type: ApplicationCommandOptionType.Integer,
		})
		days: number,
		@SlashOption({
			name: "hours",
			description: "Number of hours (max 23)",
			required: false,
			minValue: 0,
			maxValue: 23,
			type: ApplicationCommandOptionType.Integer,
		})
		hours: number,
		@SlashOption({
			name: "minutes",
			description: "Number of minutes (max 59)",
			required: false,
			minValue: 0,
			maxValue: 59,
			type: ApplicationCommandOptionType.Integer,
		})
		minutes: number,
		interaction: CommandInteraction,
	) {
		if (!(await safeDeferReply(interaction))) return;

		const result = await executeSelfMute(
			interaction,
			days || 0,
			hours || 0,
			minutes || 0,
		);

		if (typeof result === "string") {
			await safeEditReply(interaction, result);
			return;
		}

		const durationParts: string[] = [];
		if (result.days > 0) durationParts.push(`${result.days}d`);
		if (result.hours > 0) durationParts.push(`${result.hours}h`);
		if (result.minutes > 0) durationParts.push(`${result.minutes}m`);
		const durationStr = durationParts.join(" ") || "0m";

		await safeEditReply(interaction, {
			embeds: [
				{
					color: GREEN_COLOR,
					title: "detox from discord and touch grass again ?",
					description: `You'll be timed out for ${durationStr}. See you soon.`,
					timestamp: new Date().toISOString(),
					footer: { text: "Self Mute", icon_url: BOT_ICON },
				},
			],
		});
	}
}
