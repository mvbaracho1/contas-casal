-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "startInstallment" INTEGER NOT NULL DEFAULT 1,
    "firstMonth" TEXT NOT NULL,
    "purchaseId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivablePayment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_purchaseId_key" ON "Receivable"("purchaseId");

-- CreateIndex
CREATE INDEX "Receivable_coupleId_idx" ON "Receivable"("coupleId");

-- CreateIndex
CREATE INDEX "ReceivablePayment_receivableId_idx" ON "ReceivablePayment"("receivableId");

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

