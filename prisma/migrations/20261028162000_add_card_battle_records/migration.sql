-- CreateTable
CREATE TABLE "CardBattleRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "stagesCleared" INTEGER NOT NULL DEFAULT 0,
    "totalStages" INTEGER NOT NULL DEFAULT 8,
    "score" INTEGER NOT NULL DEFAULT 0,
    "deckJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardBattleRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CardBattleRecord_userId_createdAt_idx" ON "CardBattleRecord"("userId", "createdAt");
