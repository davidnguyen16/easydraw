-- Diagram "type" becomes the editor kind; the user-chosen label moves to a free
-- "category". Dashboard thumbnails are stored on the row. Admins publish
-- sample diagrams (DiagramTemplate) every account can copy.

-- Roles
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('user', 'admin'));

-- Category + thumbnail
ALTER TABLE "Diagram" ADD COLUMN "category" TEXT;
ALTER TABLE "Diagram" ADD COLUMN "thumbnail" BYTEA;
ALTER TABLE "Diagram" ADD COLUMN "thumbnailType" TEXT;
ALTER TABLE "Diagram" ADD COLUMN "thumbnailAt" TIMESTAMP(3);
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_category_check"
  CHECK ("category" IS NULL OR length(btrim("category")) BETWEEN 1 AND 40);

-- Hand-written backfill: the four fixed kinds become labels on ordinary diagrams.
UPDATE "Diagram" SET "category" = CASE "type"
  WHEN 'erd' THEN 'ERD'
  WHEN 'uml' THEN 'UML'
  WHEN 'flowchart' THEN 'Flowchart'
  WHEN 'dfd' THEN 'DFD'
END WHERE "type" IN ('erd', 'uml', 'flowchart', 'dfd');
ALTER TABLE "Diagram" DROP CONSTRAINT "Diagram_type_check";
UPDATE "Diagram" SET "type" = 'diagram' WHERE "type" IN ('erd', 'uml', 'flowchart', 'dfd');
ALTER TABLE "Diagram" ALTER COLUMN "type" SET DEFAULT 'diagram';
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_type_check"
  CHECK ("type" IN ('diagram', 'terrain', 'whiteboard'));

-- CreateTable
CREATE TABLE "DiagramTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "type" TEXT NOT NULL DEFAULT 'diagram',
    "data" JSONB NOT NULL,
    "thumbnail" BYTEA,
    "thumbnailType" TEXT,
    "thumbnailAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagramTemplate_sortOrder_createdAt_idx" ON "DiagramTemplate"("sortOrder", "createdAt");

-- AddForeignKey
ALTER TABLE "DiagramTemplate" ADD CONSTRAINT "DiagramTemplate_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: the same bounds as Diagram.
ALTER TABLE "DiagramTemplate" ADD CONSTRAINT "DiagramTemplate_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 200);
ALTER TABLE "DiagramTemplate" ADD CONSTRAINT "DiagramTemplate_category_check"
  CHECK ("category" IS NULL OR length(btrim("category")) BETWEEN 1 AND 40);
ALTER TABLE "DiagramTemplate" ADD CONSTRAINT "DiagramTemplate_type_check"
  CHECK ("type" IN ('diagram', 'terrain', 'whiteboard'));
