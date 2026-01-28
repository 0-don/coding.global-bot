import { relations } from "drizzle-orm/relations";
import { guild, guildVoiceEvents, member, memberGuild, memberRole, memberCommandHistory, memberDeletedMessages, memberHelper, memberMessages, tag, thread, threadMessage, attachment, threadTag } from "./schema";

export const guildVoiceEventsRelations = relations(guildVoiceEvents, ({one}) => ({
	guild: one(guild, {
		fields: [guildVoiceEvents.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [guildVoiceEvents.memberId],
		references: [member.memberId]
	}),
}));

export const guildRelations = relations(guild, ({many}) => ({
	guildVoiceEvents: many(guildVoiceEvents),
	memberGuilds: many(memberGuild),
	memberRoles: many(memberRole),
	memberCommandHistories: many(memberCommandHistory),
	memberDeletedMessages: many(memberDeletedMessages),
	memberHelpers: many(memberHelper),
	memberMessages: many(memberMessages),
	tags: many(tag),
	threadMessages: many(threadMessage),
	threads: many(thread),
}));

export const memberRelations = relations(member, ({many}) => ({
	guildVoiceEvents: many(guildVoiceEvents),
	memberGuilds: many(memberGuild),
	memberRoles: many(memberRole),
	memberCommandHistories: many(memberCommandHistory),
	memberDeletedMessages_deletedByMemberId: many(memberDeletedMessages, {
		relationName: "memberDeletedMessages_deletedByMemberId_member_memberId"
	}),
	memberDeletedMessages_messageMemberId: many(memberDeletedMessages, {
		relationName: "memberDeletedMessages_messageMemberId_member_memberId"
	}),
	memberHelpers: many(memberHelper),
	memberMessages: many(memberMessages),
	threadMessages: many(threadMessage),
	threads: many(thread),
}));

export const memberGuildRelations = relations(memberGuild, ({one}) => ({
	guild: one(guild, {
		fields: [memberGuild.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [memberGuild.memberId],
		references: [member.memberId]
	}),
}));

export const memberRoleRelations = relations(memberRole, ({one}) => ({
	guild: one(guild, {
		fields: [memberRole.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [memberRole.memberId],
		references: [member.memberId]
	}),
}));

export const memberCommandHistoryRelations = relations(memberCommandHistory, ({one}) => ({
	guild: one(guild, {
		fields: [memberCommandHistory.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [memberCommandHistory.memberId],
		references: [member.memberId]
	}),
}));

export const memberDeletedMessagesRelations = relations(memberDeletedMessages, ({one}) => ({
	member_deletedByMemberId: one(member, {
		fields: [memberDeletedMessages.deletedByMemberId],
		references: [member.memberId],
		relationName: "memberDeletedMessages_deletedByMemberId_member_memberId"
	}),
	guild: one(guild, {
		fields: [memberDeletedMessages.guildId],
		references: [guild.guildId]
	}),
	member_messageMemberId: one(member, {
		fields: [memberDeletedMessages.messageMemberId],
		references: [member.memberId],
		relationName: "memberDeletedMessages_messageMemberId_member_memberId"
	}),
}));

export const memberHelperRelations = relations(memberHelper, ({one}) => ({
	guild: one(guild, {
		fields: [memberHelper.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [memberHelper.memberId],
		references: [member.memberId]
	}),
}));

export const memberMessagesRelations = relations(memberMessages, ({one}) => ({
	guild: one(guild, {
		fields: [memberMessages.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [memberMessages.memberId],
		references: [member.memberId]
	}),
}));

export const tagRelations = relations(tag, ({one, many}) => ({
	guild: one(guild, {
		fields: [tag.guildId],
		references: [guild.guildId]
	}),
	threadTags: many(threadTag),
}));

export const threadMessageRelations = relations(threadMessage, ({one, many}) => ({
	thread: one(thread, {
		fields: [threadMessage.threadId],
		references: [thread.id]
	}),
	member: one(member, {
		fields: [threadMessage.authorId],
		references: [member.memberId]
	}),
	guild: one(guild, {
		fields: [threadMessage.guildId],
		references: [guild.guildId]
	}),
	attachments: many(attachment),
}));

export const threadRelations = relations(thread, ({one, many}) => ({
	threadMessages: many(threadMessage),
	guild: one(guild, {
		fields: [thread.guildId],
		references: [guild.guildId]
	}),
	member: one(member, {
		fields: [thread.authorId],
		references: [member.memberId]
	}),
	threadTags: many(threadTag),
}));

export const attachmentRelations = relations(attachment, ({one}) => ({
	threadMessage: one(threadMessage, {
		fields: [attachment.messageId],
		references: [threadMessage.id]
	}),
}));

export const threadTagRelations = relations(threadTag, ({one}) => ({
	thread: one(thread, {
		fields: [threadTag.threadId],
		references: [thread.id]
	}),
	tag: one(tag, {
		fields: [threadTag.tagId],
		references: [tag.id]
	}),
}));