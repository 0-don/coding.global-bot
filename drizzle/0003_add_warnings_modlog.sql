CREATE TABLE IF NOT EXISTS "MemberWarning" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL REFERENCES "Guild"("guildId") ON DELETE cascade ON UPDATE cascade,
	"memberId" text NOT NULL REFERENCES "Member"("memberId") ON DELETE cascade ON UPDATE cascade,
	"moderatorId" text REFERENCES "Member"("memberId") ON DELETE set null ON UPDATE cascade,
	"reason" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "MemberWarning_memberId_guildId_idx" ON "MemberWarning" USING btree ("memberId" text_ops,"guildId" text_ops);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ModLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL REFERENCES "Guild"("guildId") ON DELETE cascade ON UPDATE cascade,
	"action" text NOT NULL,
	"targetId" text NOT NULL REFERENCES "Member"("memberId") ON DELETE cascade ON UPDATE cascade,
	"moderatorId" text REFERENCES "Member"("memberId") ON DELETE set null ON UPDATE cascade,
	"reason" text,
	"channelId" text,
	"logMessageId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ModLog_guildId_createdAt_idx" ON "ModLog" USING btree ("guildId" text_ops,"createdAt" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ModLog_guildId_targetId_action_idx" ON "ModLog" USING btree ("guildId" text_ops,"targetId" text_ops,"action" text_ops);
--> statement-breakpoint
-- MemberGuild.warnings is now derived from MemberWarning rows. Carry over the
-- invite-filter counts it held so nobody's progress toward the jail resets.
INSERT INTO "MemberWarning" ("guildId", "memberId", "reason")
SELECT mg."guildId", mg."memberId", 'Posted Discord invite links (carried over from the old counter)'
FROM "MemberGuild" mg
CROSS JOIN LATERAL generate_series(1, mg."warnings")
WHERE mg."warnings" > 0
	AND EXISTS (SELECT 1 FROM "Guild" g WHERE g."guildId" = mg."guildId")
	AND EXISTS (SELECT 1 FROM "Member" m WHERE m."memberId" = mg."memberId")
	AND NOT EXISTS (
		SELECT 1 FROM "MemberWarning" w
		WHERE w."guildId" = mg."guildId" AND w."memberId" = mg."memberId"
	);
