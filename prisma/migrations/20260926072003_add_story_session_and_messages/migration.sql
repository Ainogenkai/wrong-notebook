-- CreateTable
CREATE TABLE "SystemStorySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "stageTitle" TEXT NOT NULL DEFAULT '阶段一：月考倒计时',
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT NOT NULL DEFAULT 'physics',
    "grade" TEXT NOT NULL DEFAULT '高一上',
    "currentEventJson" TEXT,
    "summary" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemStorySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "questionDataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SystemStorySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemStorySession_userId_key" ON "SystemStorySession"("userId");

-- CreateIndex
CREATE INDEX "StoryChatMessage_sessionId_createdAt_idx" ON "StoryChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryChatMessage_userId_createdAt_idx" ON "StoryChatMessage"("userId", "createdAt");
