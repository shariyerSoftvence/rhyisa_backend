-- CreateTable
CREATE TABLE "subscription_purchases" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripeInvoiceId" TEXT,
    "status" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "interval" TEXT NOT NULL,
    "description" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_purchases_stripeSessionId_key" ON "subscription_purchases"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_purchases_stripeInvoiceId_key" ON "subscription_purchases"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_purchases_userProfileId_key" ON "subscription_purchases"("userProfileId");

-- AddForeignKey
ALTER TABLE "subscription_purchases" ADD CONSTRAINT "subscription_purchases_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_purchases" ADD CONSTRAINT "subscription_purchases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
