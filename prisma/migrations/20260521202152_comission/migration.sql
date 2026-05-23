/*
  Warnings:

  - You are about to drop the column `providerProfileId` on the `commissions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_providerProfileId_fkey";

-- DropIndex
DROP INDEX "commissions_providerProfileId_key";

-- AlterTable
ALTER TABLE "commissions" DROP COLUMN "providerProfileId";
