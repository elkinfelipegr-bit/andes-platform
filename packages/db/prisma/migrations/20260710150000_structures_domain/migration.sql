-- Sprint 6 (sprint-6-domain-model.md): CalcRecord + BeamFlexureCheck.
-- CreateEnum
CREATE TYPE "calc_record_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "check_verdict" AS ENUM ('OK', 'USE_MIN', 'INCREASE_SECTION');

-- CreateTable
CREATE TABLE "calc_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "designCode" TEXT NOT NULL DEFAULT 'NSR-10',
    "fc" DECIMAL(6,2) NOT NULL,
    "fy" DECIMAL(6,2) NOT NULL,
    "notes" TEXT,
    "status" "calc_record_status" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calc_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_flexure_check" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "calcRecordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "b" DECIMAL(8,2) NOT NULL,
    "h" DECIMAL(8,2) NOT NULL,
    "cover" DECIMAL(8,2) NOT NULL,
    "mu" DECIMAL(12,2) NOT NULL,
    "d" DECIMAL(8,2) NOT NULL,
    "rhoRequired" DECIMAL(10,6),
    "rhoMin" DECIMAL(10,6) NOT NULL,
    "rhoMax" DECIMAL(10,6) NOT NULL,
    "requiredAs" DECIMAL(12,2),
    "verdict" "check_verdict" NOT NULL,

    CONSTRAINT "beam_flexure_check_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calc_record_tenantId_idx" ON "calc_record"("tenantId");

-- CreateIndex
CREATE INDEX "calc_record_projectId_idx" ON "calc_record"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "calc_record_tenantId_code_key" ON "calc_record"("tenantId", "code");

-- CreateIndex
CREATE INDEX "beam_flexure_check_tenantId_idx" ON "beam_flexure_check"("tenantId");

-- CreateIndex
CREATE INDEX "beam_flexure_check_calcRecordId_idx" ON "beam_flexure_check"("calcRecordId");

-- AddForeignKey
ALTER TABLE "calc_record" ADD CONSTRAINT "calc_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calc_record" ADD CONSTRAINT "calc_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calc_record" ADD CONSTRAINT "calc_record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_flexure_check" ADD CONSTRAINT "beam_flexure_check_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_flexure_check" ADD CONSTRAINT "beam_flexure_check_calcRecordId_fkey" FOREIGN KEY ("calcRecordId") REFERENCES "calc_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
