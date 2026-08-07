-- AlterEnum
ALTER TYPE "ProviderStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "reviewNotes" TEXT;
