-- CreateTable
CREATE TABLE "GuildMemberAdd" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "guildId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMemberAdd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMemberRemove" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "guildId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMemberRemove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberGuild" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,

    CONSTRAINT "MemberGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRole" (
    "id" SERIAL NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "MemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberBump" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "MemberBump_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberGuild_memberId_guildId_key" ON "MemberGuild"("memberId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRole_memberId_roleId_key" ON "MemberRole"("memberId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberBump_memberId_guildId_key" ON "MemberBump"("memberId", "guildId");

-- AddForeignKey
ALTER TABLE "MemberGuild" ADD CONSTRAINT "MemberGuild_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBump" ADD CONSTRAINT "MemberBump_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;
