-- CreateTable
CREATE TABLE "CommandHistory" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandHistory_pkey" PRIMARY KEY ("id")
);
