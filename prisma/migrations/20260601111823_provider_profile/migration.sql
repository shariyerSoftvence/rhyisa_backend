/*
  Warnings:

  - A unique constraint covering the columns `[governmentIssueIdUID]` on the table `ProviderProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[marketplaceInsuranceId]` on the table `ProviderProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[additionalCertificateId]` on the table `ProviderProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "additionalCertificateId" TEXT,
ADD COLUMN     "governmentIssueIdUID" TEXT,
ADD COLUMN     "marketplaceInsuranceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_governmentIssueIdUID_key" ON "ProviderProfile"("governmentIssueIdUID");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_marketplaceInsuranceId_key" ON "ProviderProfile"("marketplaceInsuranceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_additionalCertificateId_key" ON "ProviderProfile"("additionalCertificateId");

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_governmentIssueIdUID_fkey" FOREIGN KEY ("governmentIssueIdUID") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_marketplaceInsuranceId_fkey" FOREIGN KEY ("marketplaceInsuranceId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_additionalCertificateId_fkey" FOREIGN KEY ("additionalCertificateId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
