/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `MemberMessages` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MemberMessages_messageId_key" ON "MemberMessages"("messageId");
