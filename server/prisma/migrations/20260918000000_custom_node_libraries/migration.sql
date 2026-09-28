-- Additive migration: existing User/Diagram content and authentication remain intact.
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'REJECTED', 'DELETING');

CREATE TABLE "CustomNodeSection" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomNodeSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomNodeSection_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "CustomNodeSection_sortOrder_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "CustomNodeSection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "originalName" TEXT NOT NULL,
  "originalMimeType" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storedBytes" INTEGER NOT NULL DEFAULT 0,
  "uploadKey" TEXT NOT NULL,
  "s3Key" TEXT,
  "thumbnailKey" TEXT,
  "unpublishedKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "width" INTEGER,
  "height" INTEGER,
  "checksum" TEXT,
  "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Asset_size_check" CHECK ("byteSize" > 0 AND "storedBytes" >= 0),
  CONSTRAINT "Asset_dimensions_check" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)),
  CONSTRAINT "Asset_ready_check" CHECK ("status" <> 'READY' OR ("s3Key" IS NOT NULL AND "thumbnailKey" IS NOT NULL AND "width" IS NOT NULL AND "height" IS NOT NULL AND "checksum" IS NOT NULL AND "storedBytes" > 0)),
  CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CustomNodeDefinition" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "defaultWidth" DOUBLE PRECISION NOT NULL DEFAULT 120,
  "defaultHeight" DOUBLE PRECISION NOT NULL DEFAULT 120,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomNodeDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomNodeDefinition_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "CustomNodeDefinition_dimensions_check" CHECK ("defaultWidth" > 0 AND "defaultWidth" <= 4096 AND "defaultHeight" > 0 AND "defaultHeight" <= 4096),
  CONSTRAINT "CustomNodeDefinition_sortOrder_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "CustomNodeDefinition_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CustomNodeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomNodeDefinition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DiagramAsset" (
  "diagramId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagramAsset_pkey" PRIMARY KEY ("diagramId", "assetId"),
  CONSTRAINT "DiagramAsset_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiagramAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CustomNodeSection_ownerId_deletedAt_sortOrder_idx" ON "CustomNodeSection"("ownerId", "deletedAt", "sortOrder");
CREATE INDEX "CustomNodeDefinition_sectionId_deletedAt_sortOrder_idx" ON "CustomNodeDefinition"("sectionId", "deletedAt", "sortOrder");
CREATE INDEX "CustomNodeDefinition_assetId_idx" ON "CustomNodeDefinition"("assetId");
CREATE UNIQUE INDEX "Asset_uploadKey_key" ON "Asset"("uploadKey");
CREATE UNIQUE INDEX "Asset_s3Key_key" ON "Asset"("s3Key");
CREATE UNIQUE INDEX "Asset_thumbnailKey_key" ON "Asset"("thumbnailKey");
CREATE INDEX "Asset_ownerId_status_idx" ON "Asset"("ownerId", "status");
CREATE INDEX "Asset_status_updatedAt_idx" ON "Asset"("status", "updatedAt");
CREATE INDEX "DiagramAsset_assetId_idx" ON "DiagramAsset"("assetId");
