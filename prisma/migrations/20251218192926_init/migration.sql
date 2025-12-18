-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "avatarDecorationData" JSONB,
ADD COLUMN     "collectibles" JSONB,
ADD COLUMN     "hexAccentColor" TEXT,
ADD COLUMN     "primaryGuild" JSONB;

-- AlterTable
ALTER TABLE "MemberGuild" ADD COLUMN     "avatarDecorationData" JSONB,
ADD COLUMN     "bannable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "displayColor" INTEGER,
ADD COLUMN     "kickable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manageable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "moderatable" BOOLEAN NOT NULL DEFAULT true;
