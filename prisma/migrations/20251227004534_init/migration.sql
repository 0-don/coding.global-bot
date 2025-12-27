-- CreateTable
CREATE TABLE "VerificationProgress" (
    "guildId" TEXT NOT NULL,
    "processedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationProgress_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationProgress_guildId_key" ON "VerificationProgress"("guildId");
