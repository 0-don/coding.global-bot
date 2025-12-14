/*
  Warnings:

  - You are about to drop the column `gptDate` on the `MemberGuild` table. All the data in the column will be lost.
  - You are about to drop the column `gptId` on the `MemberGuild` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "accentColor" INTEGER,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3),
ADD COLUMN     "globalName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MemberGuild" DROP COLUMN "gptDate",
DROP COLUMN "gptId",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "displayHexColor" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "highestRolePosition" INTEGER,
ADD COLUMN     "joinedAt" TIMESTAMP(3),
ADD COLUMN     "presenceActivity" TEXT,
ADD COLUMN     "presenceStatus" TEXT,
ADD COLUMN     "presenceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MemberRole" ADD COLUMN     "color" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hexColor" TEXT,
ADD COLUMN     "hoist" BOOLEAN,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "managed" BOOLEAN,
ADD COLUMN     "mentionable" BOOLEAN,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "unicodeEmoji" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
