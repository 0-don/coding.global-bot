-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Guild" (
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "lookback" INTEGER NOT NULL DEFAULT 9999,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "public"."GuildVoiceEvents" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "join" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leave" TIMESTAMP(3),

    CONSTRAINT "GuildVoiceEvents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "memberId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accentColor" INTEGER,
    "bannerUrl" TEXT,
    "createdAt" TIMESTAMP(3),
    "globalName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarUrl" TEXT,
    "avatarDecorationUrl" TEXT,
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "discriminator" TEXT,
    "flags" BIGINT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "avatarDecorationData" JSONB,
    "collectibles" JSONB,
    "hexAccentColor" TEXT,
    "primaryGuild" JSONB,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "public"."MemberCommandHistory" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "MemberCommandHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberDeletedMessages" (
    "id" SERIAL NOT NULL,
    "deletedByMemberId" TEXT NOT NULL,
    "messageMemberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDeletedMessages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberGuild" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,
    "nickname" TEXT,
    "moveCounter" INTEGER NOT NULL DEFAULT 0,
    "moving" BOOLEAN NOT NULL DEFAULT false,
    "moveTimeout" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "deafened" BOOLEAN NOT NULL DEFAULT false,
    "lookback" INTEGER NOT NULL DEFAULT 9999,
    "avatarUrl" TEXT,
    "displayHexColor" TEXT,
    "displayName" TEXT,
    "highestRolePosition" INTEGER,
    "joinedAt" TIMESTAMP(3),
    "presenceActivity" TEXT,
    "presenceStatus" TEXT,
    "presenceUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannerUrl" TEXT,
    "avatarDecorationUrl" TEXT,
    "communicationDisabledUntil" TIMESTAMP(3),
    "flags" BIGINT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "premiumSince" TIMESTAMP(3),
    "avatarDecorationData" JSONB,
    "bannable" BOOLEAN NOT NULL DEFAULT true,
    "displayColor" INTEGER,
    "kickable" BOOLEAN NOT NULL DEFAULT true,
    "manageable" BOOLEAN NOT NULL DEFAULT true,
    "moderatable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MemberGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberHelper" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "threadId" TEXT,
    "threadOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberHelper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberMessages" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberMessages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberRole" (
    "id" SERIAL NOT NULL,
    "roleId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT,
    "color" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hexColor" TEXT,
    "hoist" BOOLEAN,
    "icon" TEXT,
    "managed" BOOLEAN,
    "mentionable" BOOLEAN,
    "position" INTEGER,
    "tags" JSONB,
    "unicodeEmoji" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberUpdateQueue" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberUpdateQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncProgress" (
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncProgress_pkey" PRIMARY KEY ("guildId","type")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emojiId" TEXT,
    "emojiName" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Thread" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardType" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "autoArchiveDuration" INTEGER,
    "invitable" BOOLEAN,
    "rateLimitPerUser" INTEGER,
    "flags" BIGINT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "tts" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'DEFAULT',
    "attachments" JSONB,
    "embeds" JSONB,
    "mentions" JSONB,
    "reactions" JSONB,
    "reference" JSONB,

    CONSTRAINT "ThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ThreadTag" (
    "threadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ThreadTag_pkey" PRIMARY KEY ("threadId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_guildId_key" ON "public"."Guild"("guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_key" ON "public"."Member"("memberId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MemberGuild_memberId_guildId_key" ON "public"."MemberGuild"("memberId" ASC, "guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MemberMessages_messageId_key" ON "public"."MemberMessages"("messageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MemberRole_memberId_roleId_key" ON "public"."MemberRole"("memberId" ASC, "roleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MemberUpdateQueue_memberId_guildId_key" ON "public"."MemberUpdateQueue"("memberId" ASC, "guildId" ASC);

-- CreateIndex
CREATE INDEX "Tag_guildId_idx" ON "public"."Tag"("guildId" ASC);

-- CreateIndex
CREATE INDEX "Thread_boardType_idx" ON "public"."Thread"("boardType" ASC);

-- CreateIndex
CREATE INDEX "Thread_guildId_idx" ON "public"."Thread"("guildId" ASC);

-- CreateIndex
CREATE INDEX "Thread_parentId_idx" ON "public"."Thread"("parentId" ASC);

-- CreateIndex
CREATE INDEX "ThreadMessage_authorId_idx" ON "public"."ThreadMessage"("authorId" ASC);

-- CreateIndex
CREATE INDEX "ThreadMessage_guildId_idx" ON "public"."ThreadMessage"("guildId" ASC);

-- CreateIndex
CREATE INDEX "ThreadMessage_threadId_idx" ON "public"."ThreadMessage"("threadId" ASC);

-- AddForeignKey
ALTER TABLE "public"."GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_messageMemberId_fkey" FOREIGN KEY ("messageMemberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberGuild" ADD CONSTRAINT "MemberGuild_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberGuild" ADD CONSTRAINT "MemberGuild_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberHelper" ADD CONSTRAINT "MemberHelper_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberHelper" ADD CONSTRAINT "MemberHelper_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberMessages" ADD CONSTRAINT "MemberMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberMessages" ADD CONSTRAINT "MemberMessages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberRole" ADD CONSTRAINT "MemberRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberRole" ADD CONSTRAINT "MemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Thread" ADD CONSTRAINT "Thread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Thread" ADD CONSTRAINT "Thread_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadMessage" ADD CONSTRAINT "ThreadMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadMessage" ADD CONSTRAINT "ThreadMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadMessage" ADD CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadTag" ADD CONSTRAINT "ThreadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ThreadTag" ADD CONSTRAINT "ThreadTag_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

