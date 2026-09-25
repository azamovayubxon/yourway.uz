-- CreateTable
CREATE TABLE "Teaser" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "content" JSONB,
    "aiMode" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teaser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sessionId" TEXT,
    "teaserId" TEXT,
    "ipHash" TEXT,
    "aiMode" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teaser_sessionId_locale_key" ON "Teaser"("sessionId", "locale");

-- CreateIndex
CREATE INDEX "AiCall_kind_createdAt_idx" ON "AiCall"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_ipHash_createdAt_idx" ON "AiCall"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "Teaser" ADD CONSTRAINT "Teaser_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_teaserId_fkey" FOREIGN KEY ("teaserId") REFERENCES "Teaser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
