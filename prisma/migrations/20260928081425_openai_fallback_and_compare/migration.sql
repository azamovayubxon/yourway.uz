-- AlterTable
ALTER TABLE "AiCall" ADD COLUMN     "comparisonId" TEXT,
ADD COLUMN     "fallbackFrom" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "fallbackFrom" TEXT;

-- CreateTable
CREATE TABLE "ModelComparison" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "profileSource" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "teaser" JSONB,
    "kind" TEXT NOT NULL,
    "part" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "promptVersion" TEXT NOT NULL,
    "aiMode" TEXT NOT NULL,
    "verdict" TEXT,
    "comment" TEXT,
    "ratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelComparisonVariant" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retry" JSONB,
    "lockedAt" TIMESTAMP(3),
    "content" JSONB,
    "error" TEXT,
    "problems" JSONB,
    "costUsd" DOUBLE PRECISION,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelComparisonVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelComparison_createdAt_idx" ON "ModelComparison"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelComparisonVariant_comparisonId_slot_key" ON "ModelComparisonVariant"("comparisonId", "slot");

-- AddForeignKey
ALTER TABLE "ModelComparisonVariant" ADD CONSTRAINT "ModelComparisonVariant_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ModelComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
