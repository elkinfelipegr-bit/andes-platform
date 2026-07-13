-- Sprint 10 (sprint-10-domain-model.md): InspectionPhoto.
-- CreateEnum
CREATE TYPE "photo_status" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "inspection_photo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "findingId" TEXT,
    "status" "photo_status" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_photo_storageKey_key" ON "inspection_photo"("storageKey");

-- CreateIndex
CREATE INDEX "inspection_photo_tenantId_idx" ON "inspection_photo"("tenantId");

-- CreateIndex
CREATE INDEX "inspection_photo_inspectionId_idx" ON "inspection_photo"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_photo_findingId_idx" ON "inspection_photo"("findingId");

-- AddForeignKey
ALTER TABLE "inspection_photo" ADD CONSTRAINT "inspection_photo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photo" ADD CONSTRAINT "inspection_photo_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photo" ADD CONSTRAINT "inspection_photo_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photo" ADD CONSTRAINT "inspection_photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
