-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRole" (
    "id" SERIAL NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "MemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberId_guildId_key" ON "Member"("memberId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRole_memberId_roleId_key" ON "MemberRole"("memberId", "roleId");

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;
