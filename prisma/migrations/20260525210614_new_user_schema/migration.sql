/*
  Warnings:

  - You are about to drop the column `averageFatLevel` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `bodyType` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `healthConditions` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `longTermGoal` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `mealDescription` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `shortTermGoal` on the `UserProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CurrentActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTREMELY_ACTIVE');

-- CreateEnum
CREATE TYPE "CurrentDiet" AS ENUM ('STANDARD_DIET', 'BALANCED', 'HIGH_PROTEIN', 'LOW_CARD', 'PLAN_BASED');

-- CreateEnum
CREATE TYPE "PrimaryGoal" AS ENUM ('LOSE_WEIGHT', 'BUILD_MUSCLE', 'IMPROVE_HEALTH', 'IMPROVE_OVERALL_HEALTH', 'BETTER_SLEEP', 'MANAGE_STRESS', 'OTHERS');

-- CreateEnum
CREATE TYPE "SupplementType" AS ENUM ('NONE', 'MULTIVITAMIN', 'PROTEIN_SUPPLEMENT', 'CREATINE', 'OMEGA_3');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "averageFatLevel",
DROP COLUMN "bodyType",
DROP COLUMN "healthConditions",
DROP COLUMN "longTermGoal",
DROP COLUMN "mealDescription",
DROP COLUMN "shortTermGoal",
ADD COLUMN     "currentActivityLevel" "CurrentActivityLevel",
ADD COLUMN     "currentDiet" "CurrentDiet",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "hasHealthCondition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivationLevel" INTEGER,
ADD COLUMN     "primaryGoal" "PrimaryGoal"[] DEFAULT ARRAY[]::"PrimaryGoal"[],
ADD COLUMN     "supplements" "SupplementType"[] DEFAULT ARRAY[]::"SupplementType"[];

-- DropEnum
DROP TYPE "BodyType";

-- DropEnum
DROP TYPE "FatLevelRange";

-- DropEnum
DROP TYPE "HealthCondition";

-- DropEnum
DROP TYPE "LongTermGoal";

-- DropEnum
DROP TYPE "ShortTermGoal";
