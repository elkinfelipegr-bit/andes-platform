-- Sprint 5 (sprint-5-domain-model.md): Inspection + Finding.
-- CreateEnum
CREATE TYPE "inspection_status" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finding_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "inspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "inspection_status" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "finding_severity" NOT NULL,
    "location" TEXT,

    CONSTRAINT "finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_tenantId_idx" ON "inspection"("tenantId");

-- CreateIndex
CREATE INDEX "inspection_projectId_idx" ON "inspection"("projectId");

-- CreateIndex
CREATE INDEX "inspection_inspectorId_idx" ON "inspection"("inspectorId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_tenantId_code_key" ON "inspection"("tenantId", "code");

-- CreateIndex
CREATE INDEX "finding_tenantId_idx" ON "finding"("tenantId");

-- CreateIndex
CREATE INDEX "finding_inspectionId_idx" ON "finding"("inspectionId");

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
