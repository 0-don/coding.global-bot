/*
  Warnings:

  - Added the required column `content` to the `MemberDeletedMessages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MemberDeletedMessages" ADD COLUMN     "content" TEXT NOT NULL;
