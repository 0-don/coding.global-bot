import { executeMute } from "@/core/handlers/command-handlers/mod/mute.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { BOT_ICON, GREEN_COLOR, RED_COLOR } from "@/shared/config/branding";
import {
	ApplicationCommandOptionType,
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	type CommandInteraction,
	type TextChannel,
	type User,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class MuteCommand {
	@Slash({
		name: "mute",
		description: "Timeout a user",
		defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
		dmPermission: false,
	})
	async mute(
		@SlashOption({
			name: "user",
			description: "User to mute",
			type: ApplicationCommandOptionType.User,
		})
		user: User,
		@SlashOption({
			name: "days",
			description: "Number of days (max 28)",
			required: false,
			minValue: 0,
			maxValue: 28,
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
		@SlashOption({
			name: "reason",
			description: "Reason for the mute",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		reason: string | undefined,
		interaction: CommandInteraction,
	) {
		if (
			!(await safeDeferReply(interaction, {
				flags: [MessageFlags.Ephemeral],
			}))
		)
			return;

		const result = await executeMute(
			interaction,
			user,
			days || 0,
			hours || 0,
			minutes || 0,
			reason,
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
					title: "User Muted",
					description: [
						`**User:** <@${result.mutedUser.id}>`,
						`**Duration:** ${durationStr}`,
						`**Reason:** ${result.reason}`,
					].join("\n"),
					timestamp: new Date().toISOString(),
					footer: { text: "Mute System", icon_url: BOT_ICON },
				},
			],
		});

		const jailChannel = interaction.guild?.channels.cache.find(
			(ch) =>
				ch.name.toLowerCase().includes("jail") &&
				ch.type === ChannelType.GuildText,
		) as TextChannel | undefined;

		if (jailChannel) {
			await jailChannel
				.send({
					embeds: [
						{
							color: RED_COLOR,
							title: "User Muted",
							description: [
								`**User:** <@${result.mutedUser.id}>`,
								`**Duration:** ${durationStr}`,
								`**Reason:** ${result.reason}`,
								`**Muted by:** <@${result.mutedBy.id}>`,
							].join("\n"),
							timestamp: new Date().toISOString(),
							footer: { text: "Mute System", icon_url: BOT_ICON },
						},
					],
				})
				.catch(() => {});
		}
	}
}
