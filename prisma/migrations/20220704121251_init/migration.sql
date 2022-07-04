-- CreateTable
CREATE TABLE "MemberBump" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "MemberBump_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberBump_memberId_guildId_key" ON "MemberBump"("memberId", "guildId");

-- AddForeignKey
ALTER TABLE "MemberBump" ADD CONSTRAINT "MemberBump_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;
