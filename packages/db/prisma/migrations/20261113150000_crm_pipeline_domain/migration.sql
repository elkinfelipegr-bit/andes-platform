-- Sprint 15 (sprint-15-domain-model.md): Opportunity + OpportunityActivity,
-- and Proposal.opportunityId / sentAt / decidedAt (not back-filled).
-- CreateEnum
CREATE TYPE "opportunity_stage" AS ENUM ('LEAD', 'CONTACTED', 'QUOTED', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'VISIT');


-- AlterTable
ALTER TABLE "proposal" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "opportunityId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "stage" "opportunity_stage" NOT NULL DEFAULT 'LEAD',
    "estimatedValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "source" TEXT,
    "ownerId" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "activity_type" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunity_tenantId_idx" ON "opportunity"("tenantId");

-- CreateIndex
CREATE INDEX "opportunity_clientId_idx" ON "opportunity"("clientId");

-- CreateIndex
CREATE INDEX "opportunity_activity_tenantId_idx" ON "opportunity_activity"("tenantId");

-- CreateIndex
CREATE INDEX "opportunity_activity_opportunityId_idx" ON "opportunity_activity"("opportunityId");

-- CreateIndex
CREATE INDEX "proposal_opportunityId_idx" ON "proposal"("opportunityId");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activity" ADD CONSTRAINT "opportunity_activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activity" ADD CONSTRAINT "opportunity_activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activity" ADD CONSTRAINT "opportunity_activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

