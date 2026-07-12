-- Sprint 8 (sprint-8-domain-model.md): BimModel + BimModelVersion.
-- CreateEnum
CREATE TYPE "bim_discipline" AS ENUM ('ARCHITECTURE', 'STRUCTURAL', 'MEP', 'SITE', 'OTHER');

-- CreateEnum
CREATE TYPE "bim_version_status" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "bim_model" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" "bim_discipline" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bim_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bim_model_version" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bimModelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "bim_version_status" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bim_model_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bim_model_tenantId_idx" ON "bim_model"("tenantId");

-- CreateIndex
CREATE INDEX "bim_model_projectId_idx" ON "bim_model"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "bim_model_tenantId_code_key" ON "bim_model"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bim_model_version_storageKey_key" ON "bim_model_version"("storageKey");

-- CreateIndex
CREATE INDEX "bim_model_version_tenantId_idx" ON "bim_model_version"("tenantId");

-- CreateIndex
CREATE INDEX "bim_model_version_bimModelId_idx" ON "bim_model_version"("bimModelId");

-- CreateIndex
CREATE UNIQUE INDEX "bim_model_version_bimModelId_versionNumber_key" ON "bim_model_version"("bimModelId", "versionNumber");

-- AddForeignKey
ALTER TABLE "bim_model" ADD CONSTRAINT "bim_model_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_model" ADD CONSTRAINT "bim_model_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_model" ADD CONSTRAINT "bim_model_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_model_version" ADD CONSTRAINT "bim_model_version_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_model_version" ADD CONSTRAINT "bim_model_version_bimModelId_fkey" FOREIGN KEY ("bimModelId") REFERENCES "bim_model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_model_version" ADD CONSTRAINT "bim_model_version_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
