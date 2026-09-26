-- AlterTable
ALTER TABLE "PromptVersion" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedBy" TEXT;
