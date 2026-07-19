-- Sprint 11 (sprint-11-domain-model.md): NormDocument + NormChunk.
-- Platform-scoped reference content — the ratified RFC-001 exception.

-- Accent-insensitive search ("traccion" must find "tracción").
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateTable
CREATE TABLE "norm_document" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "norm_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norm_chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "section" TEXT,
    "content" TEXT NOT NULL,
    "searchVector" tsvector,

    CONSTRAINT "norm_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "norm_document_key_key" ON "norm_document"("key");

-- CreateIndex
CREATE INDEX "norm_chunk_documentId_startLine_idx" ON "norm_chunk"("documentId", "startLine");

-- Full-text search index (populated by ingest-norms).
CREATE INDEX "norm_chunk_searchVector_idx" ON "norm_chunk" USING GIN ("searchVector");

-- AddForeignKey
ALTER TABLE "norm_chunk" ADD CONSTRAINT "norm_chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "norm_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
