-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blocker_cardId_key" ON "Blocker"("cardId");

-- CreateIndex
CREATE INDEX "Blocker_raisedAt_idx" ON "Blocker"("raisedAt");

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
