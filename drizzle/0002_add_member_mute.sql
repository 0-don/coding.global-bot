CREATE TABLE IF NOT EXISTS "MemberMute" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"moderatorId" text NOT NULL,
	"moderatorTier" text NOT NULL,
	"reason" text,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"liftedAt" timestamp(3),
	"liftedByMemberId" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "MemberMute_memberId_guildId_idx" ON "MemberMute" USING btree ("memberId" text_ops,"guildId" text_ops);
