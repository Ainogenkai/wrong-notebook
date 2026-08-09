-- CreateTable
CREATE TABLE "KnowledgeMasteryState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "masteryState" INTEGER NOT NULL DEFAULT 0,
    "probability" REAL NOT NULL DEFAULT 0.0,
    "totalTested" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "guessedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeMasteryState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiagnosticQuizRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "chapters" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "detailJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosticQuizRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KnowledgeMasteryState_userId_subject_idx" ON "KnowledgeMasteryState"("userId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeMasteryState_userId_subject_tagName_key" ON "KnowledgeMasteryState"("userId", "subject", "tagName");
