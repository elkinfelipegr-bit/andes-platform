-- Sprint 4 (sprint-4-domain-model.md): Proposal + ProposalItem.
-- CreateEnum
CREATE TYPE "proposal_status" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "projectId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "validUntil" TIMESTAMP(3),
    "status" "proposal_status" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "proposal_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_projectId_key" ON "proposal"("projectId");

-- CreateIndex
CREATE INDEX "proposal_tenantId_idx" ON "proposal"("tenantId");

-- CreateIndex
CREATE INDEX "proposal_clientId_idx" ON "proposal"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_tenantId_code_key" ON "proposal"("tenantId", "code");

-- CreateIndex
CREATE INDEX "proposal_item_tenantId_idx" ON "proposal_item"("tenantId");

-- CreateIndex
CREATE INDEX "proposal_item_proposalId_idx" ON "proposal_item"("proposalId");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
