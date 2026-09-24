CREATE TABLE IF NOT EXISTS "ModLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"action" text NOT NULL,
	"targetId" text NOT NULL,
	"moderatorId" text,
	"reason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ModLog_guildId_targetId_idx" ON "ModLog" USING btree ("guildId" text_ops,"targetId" text_ops);
