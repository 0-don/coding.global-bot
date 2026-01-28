import { pgTable, uniqueIndex, text, integer, foreignKey, serial, timestamp, boolean, bigint, jsonb, index, varchar, doublePrecision, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const guild = pgTable("Guild", {
	guildId: text().primaryKey().notNull(),
	guildName: text().notNull(),
	lookback: integer().default(9999).notNull(),
}, (table) => [
	uniqueIndex("Guild_guildId_key").using("btree", table.guildId.asc().nullsLast().op("text_ops")),
]);

export const guildVoiceEvents = pgTable("GuildVoiceEvents", {
	id: serial().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	channelId: text().notNull(),
	join: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	leave: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "GuildVoiceEvents_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "GuildVoiceEvents_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const memberUpdateQueue = pgTable("MemberUpdateQueue", {
	id: serial().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	priority: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("MemberUpdateQueue_memberId_guildId_key").using("btree", table.memberId.asc().nullsLast().op("text_ops"), table.guildId.asc().nullsLast().op("text_ops")),
]);

export const memberGuild = pgTable("MemberGuild", {
	id: serial().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	status: boolean().notNull(),
	nickname: text(),
	moveCounter: integer().default(0).notNull(),
	moving: boolean().default(false).notNull(),
	moveTimeout: integer().default(0).notNull(),
	warnings: integer().default(0).notNull(),
	muted: boolean().default(false).notNull(),
	deafened: boolean().default(false).notNull(),
	lookback: integer().default(9999).notNull(),
	avatarUrl: text(),
	displayHexColor: text(),
	displayName: text(),
	highestRolePosition: integer(),
	joinedAt: timestamp({ precision: 3, mode: 'string' }),
	presenceActivity: text(),
	presenceStatus: text(),
	presenceUpdatedAt: timestamp({ precision: 3, mode: 'string' }),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	bannerUrl: text(),
	avatarDecorationUrl: text(),
	communicationDisabledUntil: timestamp({ precision: 3, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	flags: bigint({ mode: "number" }),
	pending: boolean().default(false).notNull(),
	premiumSince: timestamp({ precision: 3, mode: 'string' }),
	avatarDecorationData: jsonb(),
	bannable: boolean().default(true).notNull(),
	displayColor: integer(),
	kickable: boolean().default(true).notNull(),
	manageable: boolean().default(true).notNull(),
	moderatable: boolean().default(true).notNull(),
}, (table) => [
	uniqueIndex("MemberGuild_memberId_guildId_key").using("btree", table.memberId.asc().nullsLast().op("text_ops"), table.guildId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberGuild_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "MemberGuild_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const member = pgTable("Member", {
	memberId: text().primaryKey().notNull(),
	username: text().notNull(),
	accentColor: integer(),
	bannerUrl: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }),
	globalName: text(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	avatarUrl: text(),
	avatarDecorationUrl: text(),
	bot: boolean().default(false).notNull(),
	discriminator: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	flags: bigint({ mode: "number" }),
	system: boolean().default(false).notNull(),
	avatarDecorationData: jsonb(),
	collectibles: jsonb(),
	hexAccentColor: text(),
	primaryGuild: jsonb(),
}, (table) => [
	uniqueIndex("Member_memberId_key").using("btree", table.memberId.asc().nullsLast().op("text_ops")),
]);

export const memberRole = pgTable("MemberRole", {
	id: serial().primaryKey().notNull(),
	roleId: text().notNull(),
	guildId: text().notNull(),
	memberId: text().notNull(),
	name: text(),
	color: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	hexColor: text(),
	hoist: boolean(),
	icon: text(),
	managed: boolean(),
	mentionable: boolean(),
	position: integer(),
	tags: jsonb(),
	unicodeEmoji: text(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("MemberRole_memberId_guildId_idx").using("btree", table.memberId.asc().nullsLast().op("text_ops"), table.guildId.asc().nullsLast().op("text_ops")),
	uniqueIndex("MemberRole_memberId_roleId_key").using("btree", table.memberId.asc().nullsLast().op("text_ops"), table.roleId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberRole_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "MemberRole_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const memberCommandHistory = pgTable("MemberCommandHistory", {
	id: serial().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	command: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	channelId: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberCommandHistory_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "MemberCommandHistory_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const memberDeletedMessages = pgTable("MemberDeletedMessages", {
	id: serial().primaryKey().notNull(),
	deletedByMemberId: text().notNull(),
	messageMemberId: text().notNull(),
	guildId: text().notNull(),
	messageId: text().notNull(),
	channelId: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.deletedByMemberId],
			foreignColumns: [member.memberId],
			name: "MemberDeletedMessages_deletedByMemberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberDeletedMessages_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.messageMemberId],
			foreignColumns: [member.memberId],
			name: "MemberDeletedMessages_messageMemberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const memberHelper = pgTable("MemberHelper", {
	id: serial().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	threadId: text(),
	threadOwnerId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberHelper_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "MemberHelper_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const memberMessages = pgTable("MemberMessages", {
	id: text().primaryKey().notNull(),
	memberId: text().notNull(),
	guildId: text().notNull(),
	messageId: text().notNull(),
	channelId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("MemberMessages_messageId_key").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "MemberMessages_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.memberId],
			name: "MemberMessages_memberId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const tag = pgTable("Tag", {
	id: text().primaryKey().notNull(),
	guildId: text().notNull(),
	name: text().notNull(),
	emojiId: text(),
	emojiName: text(),
}, (table) => [
	index("Tag_guildId_idx").using("btree", table.guildId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "Tag_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const threadMessage = pgTable("ThreadMessage", {
	id: text().primaryKey().notNull(),
	threadId: text().notNull(),
	authorId: text().notNull(),
	guildId: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	editedAt: timestamp({ precision: 3, mode: 'string' }),
	pinned: boolean().default(false).notNull(),
	tts: boolean().default(false).notNull(),
	type: text().default('DEFAULT').notNull(),
	embeds: jsonb(),
	mentions: jsonb(),
	reactions: jsonb(),
	reference: jsonb(),
}, (table) => [
	index("ThreadMessage_authorId_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("ThreadMessage_guildId_idx").using("btree", table.guildId.asc().nullsLast().op("text_ops")),
	index("ThreadMessage_threadId_idx").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [thread.id],
			name: "ThreadMessage_threadId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [member.memberId],
			name: "ThreadMessage_authorId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "ThreadMessage_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const thread = pgTable("Thread", {
	id: text().primaryKey().notNull(),
	guildId: text().notNull(),
	parentId: text(),
	authorId: text().notNull(),
	name: text().notNull(),
	boardType: text().notNull(),
	messageCount: integer().default(0).notNull(),
	memberCount: integer().default(0).notNull(),
	locked: boolean().default(false).notNull(),
	archived: boolean().default(false).notNull(),
	archivedAt: timestamp({ precision: 3, mode: 'string' }),
	autoArchiveDuration: integer(),
	invitable: boolean(),
	rateLimitPerUser: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	flags: bigint({ mode: "number" }),
	createdAt: timestamp({ precision: 3, mode: 'string' }),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	lastActivityAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	index("Thread_boardType_idx").using("btree", table.boardType.asc().nullsLast().op("text_ops")),
	index("Thread_guildId_idx").using("btree", table.guildId.asc().nullsLast().op("text_ops")),
	index("Thread_parentId_idx").using("btree", table.parentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.guildId],
			foreignColumns: [guild.guildId],
			name: "Thread_guildId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [member.memberId],
			name: "Thread_authorId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const attachment = pgTable("Attachment", {
	id: text().primaryKey().notNull(),
	messageId: text().notNull(),
	url: text().notNull(),
	proxyUrl: text().notNull(),
	name: text().notNull(),
	description: text(),
	contentType: text(),
	size: integer().notNull(),
	width: integer(),
	height: integer(),
	ephemeral: boolean().default(false).notNull(),
	duration: doublePrecision(),
	waveform: text(),
	flags: text(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	failedRefreshAttempts: integer().default(0).notNull(),
}, (table) => [
	index("Attachment_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("Attachment_messageId_idx").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [threadMessage.id],
			name: "Attachment_messageId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const threadTag = pgTable("ThreadTag", {
	threadId: text().notNull(),
	tagId: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [thread.id],
			name: "ThreadTag_threadId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tag.id],
			name: "ThreadTag_tagId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.threadId, table.tagId], name: "ThreadTag_pkey"}),
]);

export const syncProgress = pgTable("SyncProgress", {
	guildId: text().notNull(),
	type: text().notNull(),
	processedIds: text().array().default(["RAY"]),
	failedIds: text().array().default(["RAY"]),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	primaryKey({ columns: [table.type, table.guildId], name: "SyncProgress_pkey"}),
]);
