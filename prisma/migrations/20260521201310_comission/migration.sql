/*
  Warnings:

  - You are about to drop the column `commissionRate` on the `ProviderProfile` table. All the data in the column will be lost.
  - You are about to drop the column `commissionType` on the `ProviderProfile` table. All the data in the column will be lost.
  - You are about to drop the column `bodyPhotoId` on the `UserProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[profileImageId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_bodyPhotoId_fkey";

-- DropIndex
DROP INDEX "UserProfile_bodyPhotoId_key";

-- AlterTable
ALTER TABLE "ProviderProfile" DROP COLUMN "commissionRate",
DROP COLUMN "commissionType";

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "bodyPhotoId",
ADD COLUMN     "profileImageId" TEXT;

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'FLAT',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "providerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_providerProfileId_key" ON "commissions"("providerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_profileImageId_key" ON "UserProfile"("profileImageId");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_profileImageId_fkey" FOREIGN KEY ("profileImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
