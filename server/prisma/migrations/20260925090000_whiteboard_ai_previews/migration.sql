-- Additive only: legacy Diagram.data is neither rewritten nor interpreted.
CREATE TYPE "DiagramPreviewStatus" AS ENUM ('PROCESSING','READY','UNRECOGNIZED','FAILED','CANCELLED','EXPIRED');
CREATE TYPE "PreviewSnapshotStatus" AS ENUM ('PENDING','READY','DELETING');

CREATE TABLE "PreviewSourceSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT,
  "sourceObjectKey" TEXT NOT NULL,
  "modelInputObjectKey" TEXT NOT NULL,
  "unpublishedKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceSHA256" TEXT NOT NULL,
  "modelInputSHA256" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "modelInputWidth" INTEGER NOT NULL,
  "modelInputHeight" INTEGER NOT NULL,
  "status" "PreviewSnapshotStatus" NOT NULL DEFAULT 'PENDING',
  "cleanupAfter" TIMESTAMP(3) NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreviewSourceSnapshot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PreviewSourceSnapshot_dimensions_check" CHECK (
    width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192 AND width::BIGINT * height <= 16000000
    AND "modelInputWidth" BETWEEN 1 AND 2048 AND "modelInputHeight" BETWEEN 1 AND 2048
    AND "byteSize" BETWEEN 1 AND 4194304),
  CONSTRAINT "PreviewSourceSnapshot_hashes_check" CHECK (
    "sourceSHA256" ~ '^[a-f0-9]{64}$' AND "modelInputSHA256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "PreviewSourceSnapshot_sourceObjectKey_key" ON "PreviewSourceSnapshot"("sourceObjectKey");
CREATE UNIQUE INDEX "PreviewSourceSnapshot_modelInputObjectKey_key" ON "PreviewSourceSnapshot"("modelInputObjectKey");
CREATE INDEX "PreviewSourceSnapshot_cleanupAfter_leaseUntil_idx" ON "PreviewSourceSnapshot"("cleanupAfter","leaseUntil");
CREATE INDEX "PreviewSourceSnapshot_ownerId_idx" ON "PreviewSourceSnapshot"("ownerId");

CREATE TABLE "DiagramPreview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "sourceWhiteboardId" TEXT,
  "sourceSnapshotId" TEXT,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT,
  "clientRevision" INTEGER,
  "sourceSHA256" TEXT,
  "sourceWidth" INTEGER,
  "sourceHeight" INTEGER,
  "status" "DiagramPreviewStatus" NOT NULL DEFAULT 'PROCESSING',
  "errorCode" TEXT,
  "warnings" JSONB,
  "requestedModel" TEXT NOT NULL,
  "resolvedModel" TEXT,
  "inputPipelineVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "outputSchemaVersion" TEXT NOT NULL,
  "converterVersion" TEXT NOT NULL,
  "convertedDocument" JSONB,
  "documentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagramPreview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiagramPreview_sourceWhiteboardId_fkey" FOREIGN KEY ("sourceWhiteboardId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DiagramPreview_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "PreviewSourceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DiagramPreview_ready_check" CHECK (status <> 'READY' OR ("convertedDocument" IS NOT NULL AND "documentHash" IS NOT NULL AND "readyAt" IS NOT NULL)),
  CONSTRAINT "DiagramPreview_hashes_check" CHECK (
    ("requestFingerprint" IS NULL OR "requestFingerprint" ~ '^[a-f0-9]{64}$')
    AND ("sourceSHA256" IS NULL OR "sourceSHA256" ~ '^[a-f0-9]{64}$')
    AND ("documentHash" IS NULL OR "documentHash" ~ '^[a-f0-9]{64}$')),
  CONSTRAINT "DiagramPreview_revision_check" CHECK ("clientRevision" IS NULL OR "clientRevision" >= 0)
);
CREATE UNIQUE INDEX "DiagramPreview_ownerId_clientRequestId_key" ON "DiagramPreview"("ownerId","clientRequestId");
-- Owner locks enforce quota atomically; this is an additional DB backstop.
CREATE UNIQUE INDEX "DiagramPreview_one_processing_per_owner" ON "DiagramPreview"("ownerId") WHERE status = 'PROCESSING';
CREATE INDEX "DiagramPreview_ownerId_createdAt_idx" ON "DiagramPreview"("ownerId","createdAt");
CREATE INDEX "DiagramPreview_ownerId_dispatchedAt_idx" ON "DiagramPreview"("ownerId","dispatchedAt");
CREATE INDEX "DiagramPreview_status_leaseUntil_idx" ON "DiagramPreview"("status","leaseUntil");
CREATE INDEX "DiagramPreview_sourceWhiteboardId_idx" ON "DiagramPreview"("sourceWhiteboardId");
CREATE INDEX "DiagramPreview_sourceSnapshotId_idx" ON "DiagramPreview"("sourceSnapshotId");
