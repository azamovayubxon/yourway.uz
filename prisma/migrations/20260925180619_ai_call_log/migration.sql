-- AlterTable
ALTER TABLE "AiCall" ADD COLUMN     "locale" TEXT,
ADD COLUMN     "problems" JSONB,
ADD COLUMN     "responseText" TEXT;
