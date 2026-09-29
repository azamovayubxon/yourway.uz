-- CreateTable
CREATE TABLE "ShareCard" (
    "code" TEXT NOT NULL,
    "teaserId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareCard_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareCard_teaserId_key" ON "ShareCard"("teaserId");

-- AddForeignKey
ALTER TABLE "ShareCard" ADD CONSTRAINT "ShareCard_teaserId_fkey" FOREIGN KEY ("teaserId") REFERENCES "Teaser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
