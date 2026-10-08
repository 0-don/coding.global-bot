CREATE TABLE IF NOT EXISTS "RecentMessages" (
	"messageId" text PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"channelId" text NOT NULL,
	"authorId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RecentMessages_guildId_authorId_idx" ON "RecentMessages" USING btree ("guildId" text_ops,"authorId" text_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RecentMessages_createdAt_idx" ON "RecentMessages" USING btree ("createdAt");
--> statement-breakpoint
INSERT INTO "RecentMessages" ("messageId", "guildId", "channelId", "authorId", "createdAt")
SELECT "messageId", "guildId", "channelId", "memberId", "createdAt" FROM "MemberMessages"
WHERE "createdAt" > CURRENT_TIMESTAMP - INTERVAL '14 days'
ON CONFLICT DO NOTHING;
