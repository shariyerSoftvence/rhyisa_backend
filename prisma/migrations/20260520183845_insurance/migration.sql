/*
  Warnings:

  - The values [INSURANCE] on the enum `RoleType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[serial]` on the table `insurance_companies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleType_new" AS ENUM ('USER', 'PROVIDER', 'ADMIN');
ALTER TABLE "public"."Auth" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Auth" ALTER COLUMN "role" TYPE "RoleType_new" USING ("role"::text::"RoleType_new");
ALTER TYPE "RoleType" RENAME TO "RoleType_old";
ALTER TYPE "RoleType_new" RENAME TO "RoleType";
DROP TYPE "public"."RoleType_old";
ALTER TABLE "Auth" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "insurance_companies" ADD COLUMN     "serial" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_serial_key" ON "insurance_companies"("serial");
