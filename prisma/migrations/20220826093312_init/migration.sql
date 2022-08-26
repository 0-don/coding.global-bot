/*
  Warnings:

  - The primary key for the `MemberMessages` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "MemberMessages" DROP CONSTRAINT "MemberMessages_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "MemberMessages_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MemberMessages_id_seq";
