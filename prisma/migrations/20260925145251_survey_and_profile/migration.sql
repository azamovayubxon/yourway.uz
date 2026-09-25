-- AlterTable
ALTER TABLE "TestSession" ADD COLUMN     "profile" JSONB,
ADD COLUMN     "profileDoneAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("sessionId","questionId")
);

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
