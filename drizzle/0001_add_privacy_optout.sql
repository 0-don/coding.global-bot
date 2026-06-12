ALTER TABLE "MemberGuild" ADD COLUMN IF NOT EXISTS "messageOptOut" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "MemberGuild" ADD COLUMN IF NOT EXISTS "presenceOptOut" boolean DEFAULT false NOT NULL;
