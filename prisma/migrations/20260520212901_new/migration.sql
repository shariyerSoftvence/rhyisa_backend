/*
  Warnings:

  - The `averageFatLevel` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `healthConditions` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `longTermGoal` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `shortTermGoal` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `mealDescription` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FatLevelRange" AS ENUM ('ESSENTIAL', 'ATHLETE', 'FITNESS', 'ACCEPTABLE', 'HIGH', 'OBESE');

-- CreateEnum
CREATE TYPE "HealthCondition" AS ENUM ('NONE', 'DIABETES_TYPE_1', 'DIABETES_TYPE_2', 'HYPERTENSION', 'HYPOTENSION', 'CARDIOVASCULAR', 'ASTHMA_RESPIRATORY', 'PREGNANCY', 'POST_PARTUM', 'ARTHRITIS_JOINT_PAIN', 'KIDNEY_DISEASE', 'THYROID_DISORDER', 'CHRONIC_FATIGUE');

-- CreateEnum
CREATE TYPE "ShortTermGoal" AS ENUM ('LOSE_WEIGHT_QUICKLY', 'KICKSTART_METABOLISM', 'DETOX_CLEANSE', 'ADAPT_HEALTHY_EATING', 'IMPROVE_DAILY_HYDRATION', 'STAMINA_BOOST_WEEKLY', 'REDUCE_SUGAR_CRAVING');

-- CreateEnum
CREATE TYPE "LongTermGoal" AS ENUM ('SUSTAINABLE_WEIGHT_LOSS', 'MUSCLE_HYPERTROPHY', 'REVERSE_DIABETES_PREDIABETES', 'CARDIOVASCULAR_ENDURANCE', 'ANTI_AGING_LONGEVITY', 'STRESS_MANAGEMENT_MENTAL_CLARITY', 'HOLISTIC_LIFESTYLE_TRANSFORMATION');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "mealDescription" TEXT NOT NULL,
DROP COLUMN "averageFatLevel",
ADD COLUMN     "averageFatLevel" "FatLevelRange",
DROP COLUMN "healthConditions",
ADD COLUMN     "healthConditions" "HealthCondition"[],
DROP COLUMN "longTermGoal",
ADD COLUMN     "longTermGoal" "LongTermGoal",
DROP COLUMN "shortTermGoal",
ADD COLUMN     "shortTermGoal" "ShortTermGoal";
