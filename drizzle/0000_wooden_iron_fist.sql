-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "Guild" (
	"guildId" text PRIMARY KEY NOT NULL,
	"guildName" text NOT NULL,
	"lookback" integer DEFAULT 9999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "GuildVoiceEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"channelId" text NOT NULL,
	"join" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"leave" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "MemberUpdateQueue" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberGuild" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"status" boolean NOT NULL,
	"nickname" text,
	"moveCounter" integer DEFAULT 0 NOT NULL,
	"moving" boolean DEFAULT false NOT NULL,
	"moveTimeout" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"deafened" boolean DEFAULT false NOT NULL,
	"lookback" integer DEFAULT 9999 NOT NULL,
	"avatarUrl" text,
	"displayHexColor" text,
	"displayName" text,
	"highestRolePosition" integer,
	"joinedAt" timestamp(3),
	"presenceActivity" text,
	"presenceStatus" text,
	"presenceUpdatedAt" timestamp(3),
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"bannerUrl" text,
	"avatarDecorationUrl" text,
	"communicationDisabledUntil" timestamp(3),
	"flags" bigint,
	"pending" boolean DEFAULT false NOT NULL,
	"premiumSince" timestamp(3),
	"avatarDecorationData" jsonb,
	"bannable" boolean DEFAULT true NOT NULL,
	"displayColor" integer,
	"kickable" boolean DEFAULT true NOT NULL,
	"manageable" boolean DEFAULT true NOT NULL,
	"moderatable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Member" (
	"memberId" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"accentColor" integer,
	"bannerUrl" text,
	"createdAt" timestamp(3),
	"globalName" text,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"avatarUrl" text,
	"avatarDecorationUrl" text,
	"bot" boolean DEFAULT false NOT NULL,
	"discriminator" text,
	"flags" bigint,
	"system" boolean DEFAULT false NOT NULL,
	"avatarDecorationData" jsonb,
	"collectibles" jsonb,
	"hexAccentColor" text,
	"primaryGuild" jsonb
);
--> statement-breakpoint
CREATE TABLE "MemberRole" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleId" text NOT NULL,
	"guildId" text NOT NULL,
	"memberId" text NOT NULL,
	"name" text,
	"color" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"hexColor" text,
	"hoist" boolean,
	"icon" text,
	"managed" boolean,
	"mentionable" boolean,
	"position" integer,
	"tags" jsonb,
	"unicodeEmoji" text,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberCommandHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"command" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"channelId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberDeletedMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"deletedByMemberId" text NOT NULL,
	"messageMemberId" text NOT NULL,
	"guildId" text NOT NULL,
	"messageId" text NOT NULL,
	"channelId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberHelper" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"threadId" text,
	"threadOwnerId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberMessages" (
	"id" text PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"messageId" text NOT NULL,
	"channelId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" text PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"name" text NOT NULL,
	"emojiId" text,
	"emojiName" text
);
--> statement-breakpoint
CREATE TABLE "ThreadMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"threadId" text NOT NULL,
	"authorId" text NOT NULL,
	"guildId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp(3) NOT NULL,
	"editedAt" timestamp(3),
	"pinned" boolean DEFAULT false NOT NULL,
	"tts" boolean DEFAULT false NOT NULL,
	"type" text DEFAULT 'DEFAULT' NOT NULL,
	"embeds" jsonb,
	"mentions" jsonb,
	"reactions" jsonb,
	"reference" jsonb
);
--> statement-breakpoint
CREATE TABLE "Thread" (
	"id" text PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"parentId" text,
	"authorId" text NOT NULL,
	"name" text NOT NULL,
	"boardType" text NOT NULL,
	"messageCount" integer DEFAULT 0 NOT NULL,
	"memberCount" integer DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archivedAt" timestamp(3),
	"autoArchiveDuration" integer,
	"invitable" boolean,
	"rateLimitPerUser" integer,
	"flags" bigint,
	"createdAt" timestamp(3),
	"updatedAt" timestamp(3) NOT NULL,
	"lastActivityAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "Attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"url" text NOT NULL,
	"proxyURL" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"contentType" text,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"ephemeral" boolean DEFAULT false NOT NULL,
	"duration" double precision,
	"waveform" text,
	"flags" text,
	"expiresAt" timestamp(3),
	"failedRefreshAttempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ThreadTag" (
	"threadId" text NOT NULL,
	"tagId" text NOT NULL,
	CONSTRAINT "ThreadTag_pkey" PRIMARY KEY("threadId","tagId")
);
--> statement-breakpoint
CREATE TABLE "SyncProgress" (
	"guildId" text NOT NULL,
	"type" text NOT NULL,
	"processedIds" text[] DEFAULT '{"RAY"}',
	"failedIds" text[] DEFAULT '{"RAY"}',
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "SyncProgress_pkey" PRIMARY KEY("type","guildId")
);
--> statement-breakpoint
ALTER TABLE "GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberGuild" ADD CONSTRAINT "MemberGuild_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberGuild" ADD CONSTRAINT "MemberGuild_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_messageMemberId_fkey" FOREIGN KEY ("messageMemberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberHelper" ADD CONSTRAINT "MemberHelper_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberHelper" ADD CONSTRAINT "MemberHelper_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Member"("memberId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Member"("memberId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ThreadMessage"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ThreadTag" ADD CONSTRAINT "ThreadTag_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ThreadTag" ADD CONSTRAINT "ThreadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Guild_guildId_key" ON "Guild" USING btree ("guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberUpdateQueue_memberId_guildId_key" ON "MemberUpdateQueue" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberGuild_memberId_guildId_key" ON "MemberGuild" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member" USING btree ("memberId" text_ops);--> statement-breakpoint
CREATE INDEX "MemberRole_memberId_guildId_idx" ON "MemberRole" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberRole_memberId_roleId_key" ON "MemberRole" USING btree ("memberId" text_ops,"roleId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberMessages_messageId_key" ON "MemberMessages" USING btree ("messageId" text_ops);--> statement-breakpoint
CREATE INDEX "Tag_guildId_idx" ON "Tag" USING btree ("guildId" text_ops);--> statement-breakpoint
CREATE INDEX "ThreadMessage_authorId_idx" ON "ThreadMessage" USING btree ("authorId" text_ops);--> statement-breakpoint
CREATE INDEX "ThreadMessage_guildId_idx" ON "ThreadMessage" USING btree ("guildId" text_ops);--> statement-breakpoint
CREATE INDEX "ThreadMessage_threadId_idx" ON "ThreadMessage" USING btree ("threadId" text_ops);--> statement-breakpoint
CREATE INDEX "Thread_boardType_idx" ON "Thread" USING btree ("boardType" text_ops);--> statement-breakpoint
CREATE INDEX "Thread_guildId_idx" ON "Thread" USING btree ("guildId" text_ops);--> statement-breakpoint
CREATE INDEX "Thread_parentId_idx" ON "Thread" USING btree ("parentId" text_ops);--> statement-breakpoint
CREATE INDEX "Attachment_expiresAt_idx" ON "Attachment" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Attachment_messageId_idx" ON "Attachment" USING btree ("messageId" text_ops);
*/