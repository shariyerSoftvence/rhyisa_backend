/*
  Warnings:

  - You are about to drop the column `isRead` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `receiverId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `referenceId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the `conversations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[bodyPhotoId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `meta` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LiveChatType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "LiveMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "LiveMediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CALLING', 'RINING', 'ACTIVE', 'END', 'MISSED', 'DECLINED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "DataAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('ECTOMORPH', 'MESOMORPH', 'ENDOMORPH', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('FREE', 'PREMIUM');

-- AlterEnum
ALTER TYPE "RoleType" ADD VALUE 'INSURANCE';

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_participantOneId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_participantTwoId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_receiverId_fkey";

-- AlterTable
ALTER TABLE "Auth" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
ADD COLUMN     "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "averageFatLevel" DOUBLE PRECISION,
ADD COLUMN     "bodyPhotoId" TEXT,
ADD COLUMN     "bodyType" "BodyType",
ADD COLUMN     "healthConditions" TEXT,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "longTermGoal" TEXT,
ADD COLUMN     "shortTermGoal" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "subscriptionType" "SubscriptionType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "daily_health_logs" ADD COLUMN     "carbsGoal" INTEGER NOT NULL DEFAULT 250,
ADD COLUMN     "carbsGrams" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fatGoal" INTEGER NOT NULL DEFAULT 65,
ADD COLUMN     "fatGrams" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "isRead",
DROP COLUMN "receiverId",
DROP COLUMN "referenceId",
ADD COLUMN     "meta" JSONB NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropTable
DROP TABLE "conversations";

-- DropTable
DROP TABLE "messages";

-- DropEnum
DROP TYPE "NotificationType";

-- CreateTable
CREATE TABLE "live_chats" (
    "id" TEXT NOT NULL,
    "type" "LiveChatType" NOT NULL DEFAULT 'INDIVIDUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "live_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participants" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "mediaType" "LiveMediaType",
    "status" "LiveMessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_message_reads" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liveChatId" TEXT,

    CONSTRAINT "live_message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'CALLING',
    "title" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "socketId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "externalLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_data_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "DataAccessStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_data_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_chats_createdById_idx" ON "live_chats"("createdById");

-- CreateIndex
CREATE INDEX "live_chats_type_idx" ON "live_chats"("type");

-- CreateIndex
CREATE INDEX "chat_participants_chatId_idx" ON "chat_participants"("chatId");

-- CreateIndex
CREATE INDEX "chat_participants_userId_idx" ON "chat_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_participants_chatId_userId_key" ON "chat_participants"("chatId", "userId");

-- CreateIndex
CREATE INDEX "live_messages_chatId_idx" ON "live_messages"("chatId");

-- CreateIndex
CREATE INDEX "live_messages_senderId_idx" ON "live_messages"("senderId");

-- CreateIndex
CREATE INDEX "live_messages_createdAt_idx" ON "live_messages"("createdAt");

-- CreateIndex
CREATE INDEX "live_message_reads_messageId_idx" ON "live_message_reads"("messageId");

-- CreateIndex
CREATE INDEX "live_message_reads_userId_idx" ON "live_message_reads"("userId");

-- CreateIndex
CREATE INDEX "live_message_reads_liveChatId_idx" ON "live_message_reads"("liveChatId");

-- CreateIndex
CREATE UNIQUE INDEX "live_message_reads_messageId_userId_key" ON "live_message_reads"("messageId", "userId");

-- CreateIndex
CREATE INDEX "calls_hostUserId_idx" ON "calls"("hostUserId");

-- CreateIndex
CREATE INDEX "calls_recipientUserId_idx" ON "calls"("recipientUserId");

-- CreateIndex
CREATE INDEX "call_participants_callId_idx" ON "call_participants"("callId");

-- CreateIndex
CREATE INDEX "call_participants_socketId_idx" ON "call_participants"("socketId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_name_key" ON "insurance_companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_userId_notificationId_key" ON "user_notifications"("userId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_data_access_userId_providerId_key" ON "provider_data_access"("userId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_bodyPhotoId_key" ON "UserProfile"("bodyPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_stripeCustomerId_key" ON "UserProfile"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "live_chats" ADD CONSTRAINT "live_chats_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Auth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "live_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_messages" ADD CONSTRAINT "live_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "live_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_messages" ADD CONSTRAINT "live_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_message_reads" ADD CONSTRAINT "live_message_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "live_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_message_reads" ADD CONSTRAINT "live_message_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_message_reads" ADD CONSTRAINT "live_message_reads_liveChatId_fkey" FOREIGN KEY ("liveChatId") REFERENCES "live_chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "Auth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "Auth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_data_access" ADD CONSTRAINT "provider_data_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_data_access" ADD CONSTRAINT "provider_data_access_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_bodyPhotoId_fkey" FOREIGN KEY ("bodyPhotoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
