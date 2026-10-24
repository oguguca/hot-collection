-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotWheelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result" JSONB,
    "sources" JSONB,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_createdAt_idx" ON "AiAnalysis"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_hotWheelId_createdAt_idx" ON "AiAnalysis"("userId", "hotWheelId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_hotWheelId_fkey" FOREIGN KEY ("hotWheelId") REFERENCES "HotWheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

