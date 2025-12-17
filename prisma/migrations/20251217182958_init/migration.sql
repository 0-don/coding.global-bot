-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "avatarDecorationUrl" TEXT,
ADD COLUMN     "bot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discriminator" TEXT,
ADD COLUMN     "flags" BIGINT,
ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MemberGuild" ADD COLUMN     "avatarDecorationUrl" TEXT,
ADD COLUMN     "communicationDisabledUntil" TIMESTAMP(3),
ADD COLUMN     "flags" BIGINT,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "premiumSince" TIMESTAMP(3);
