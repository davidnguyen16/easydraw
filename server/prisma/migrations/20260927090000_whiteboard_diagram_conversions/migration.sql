-- Additive only: no existing Diagram.data, IDs, titles or owners are rewritten.
-- A VisualDocument groups designs; it is not an additional editor document.
CREATE TABLE "VisualDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisualDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VisualDocument_ownerId_updatedAt_idx" ON "VisualDocument"("ownerId", "updatedAt" DESC);

ALTER TABLE "Diagram" ADD COLUMN "visualDocumentId" TEXT;
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_visualDocumentId_fkey" FOREIGN KEY ("visualDocumentId") REFERENCES "VisualDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Diagram_visualDocumentId_idx" ON "Diagram"("visualDocumentId");

-- previewId intentionally has no FK: expiry/pruning cannot erase idempotency.
-- Snapshot RESTRICT complements the locked reference check before any S3 delete.
CREATE TABLE "DiagramConversion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "previewId" TEXT NOT NULL,
  "diagramId" TEXT,
  "sourceWhiteboardId" TEXT,
  "sourceSnapshotId" TEXT,
  "sourceSHA256" TEXT NOT NULL,
  "approvedDocument" JSONB,
  "documentHash" TEXT NOT NULL,
  "requestedModel" TEXT NOT NULL,
  "resolvedModel" TEXT,
  "inputPipelineVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "outputSchemaVersion" TEXT NOT NULL,
  "converterVersion" TEXT NOT NULL,
  "acknowledgedStale" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diagramDeletedAt" TIMESTAMP(3),
  CONSTRAINT "DiagramConversion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiagramConversion_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DiagramConversion_sourceWhiteboardId_fkey" FOREIGN KEY ("sourceWhiteboardId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DiagramConversion_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "PreviewSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DiagramConversion_hashes_check" CHECK (
    "sourceSHA256" ~ '^[a-f0-9]{64}$' AND "documentHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "DiagramConversion_live_payload_check" CHECK (
    "diagramId" IS NULL OR ("approvedDocument" IS NOT NULL AND "sourceSnapshotId" IS NOT NULL)),
  CONSTRAINT "DiagramConversion_deleted_payload_check" CHECK (
    "diagramDeletedAt" IS NULL OR ("diagramId" IS NULL AND "approvedDocument" IS NULL AND "sourceSnapshotId" IS NULL))
);
CREATE UNIQUE INDEX "DiagramConversion_previewId_key" ON "DiagramConversion"("previewId");
CREATE UNIQUE INDEX "DiagramConversion_diagramId_key" ON "DiagramConversion"("diagramId");
CREATE INDEX "DiagramConversion_ownerId_createdAt_idx" ON "DiagramConversion"("ownerId", "createdAt");
CREATE INDEX "DiagramConversion_sourceWhiteboardId_idx" ON "DiagramConversion"("sourceWhiteboardId");
CREATE INDEX "DiagramConversion_sourceSnapshotId_idx" ON "DiagramConversion"("sourceSnapshotId");
