/*
  Warnings:

  - Added the required column `channelId` to the `MemberCommandHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MemberCommandHistory" ADD COLUMN     "channelId" TEXT NOT NULL;
