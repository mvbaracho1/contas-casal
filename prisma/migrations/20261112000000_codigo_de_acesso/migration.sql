-- CreateTable
CREATE TABLE "SignupCodeAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupCodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupCodeAttempt_ip_createdAt_idx" ON "SignupCodeAttempt"("ip", "createdAt");

