/*
  Warnings:

  - You are about to drop the column `calorieGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `carbsGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `energyGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `fatGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `proteinGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `stepsGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - You are about to drop the column `waterGoal` on the `daily_health_logs` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `daily_health_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "daily_health_logs" DROP COLUMN "calorieGoal",
DROP COLUMN "carbsGoal",
DROP COLUMN "energyGoal",
DROP COLUMN "fatGoal",
DROP COLUMN "proteinGoal",
DROP COLUMN "stepsGoal",
DROP COLUMN "waterGoal",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "sleepHours" SET DEFAULT 0,
ALTER COLUMN "sleepMinutes" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "user_health_goals" (
    "id" TEXT NOT NULL,
    "calorieGoal" INTEGER NOT NULL DEFAULT 2000,
    "waterGoal" INTEGER NOT NULL DEFAULT 8,
    "proteinGoal" INTEGER NOT NULL DEFAULT 120,
    "carbsGoal" INTEGER NOT NULL DEFAULT 250,
    "fatGoal" INTEGER NOT NULL DEFAULT 65,
    "stepsGoal" INTEGER NOT NULL DEFAULT 6000,
    "sleepGoalHours" INTEGER NOT NULL DEFAULT 8,
    "generatedByAI" BOOLEAN NOT NULL DEFAULT true,
    "userProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_health_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_health_goals_userProfileId_key" ON "user_health_goals"("userProfileId");

-- AddForeignKey
ALTER TABLE "user_health_goals" ADD CONSTRAINT "user_health_goals_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
