-- Sprint 7 (sprint-7-domain-model.md): GeoRecord + BearingCheck.
-- CreateEnum
CREATE TYPE "geo_record_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "footing_shape" AS ENUM ('STRIP', 'SQUARE');

-- CreateTable
CREATE TABLE "geo_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "geo_record_status" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bearing_check" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "geoRecordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "b" DECIMAL(8,2) NOT NULL,
    "df" DECIMAL(8,2) NOT NULL,
    "gamma" DECIMAL(6,2) NOT NULL,
    "c" DECIMAL(8,2) NOT NULL,
    "phi" DECIMAL(5,2) NOT NULL,
    "fs" DECIMAL(4,2) NOT NULL,
    "shape" "footing_shape" NOT NULL,
    "nc" DECIMAL(10,3) NOT NULL,
    "nq" DECIMAL(10,3) NOT NULL,
    "ngamma" DECIMAL(10,3) NOT NULL,
    "qUlt" DECIMAL(12,2) NOT NULL,
    "qAdm" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "bearing_check_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geo_record_tenantId_idx" ON "geo_record"("tenantId");

-- CreateIndex
CREATE INDEX "geo_record_projectId_idx" ON "geo_record"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "geo_record_tenantId_code_key" ON "geo_record"("tenantId", "code");

-- CreateIndex
CREATE INDEX "bearing_check_tenantId_idx" ON "bearing_check"("tenantId");

-- CreateIndex
CREATE INDEX "bearing_check_geoRecordId_idx" ON "bearing_check"("geoRecordId");

-- AddForeignKey
ALTER TABLE "geo_record" ADD CONSTRAINT "geo_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_record" ADD CONSTRAINT "geo_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_record" ADD CONSTRAINT "geo_record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bearing_check" ADD CONSTRAINT "bearing_check_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bearing_check" ADD CONSTRAINT "bearing_check_geoRecordId_fkey" FOREIGN KEY ("geoRecordId") REFERENCES "geo_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
