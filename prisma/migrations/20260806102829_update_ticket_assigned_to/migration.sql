-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assignedToId" TEXT;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Auth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
