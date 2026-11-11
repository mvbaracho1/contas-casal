-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "endMonth" TEXT,
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

