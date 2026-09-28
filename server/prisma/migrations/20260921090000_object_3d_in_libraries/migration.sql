-- 3D objects join the owner's private libraries (CustomNodeSection) so one
-- library can hold image nodes and 3D objects and is managed the same way.
ALTER TABLE "CustomObject3D" ADD COLUMN "sectionId" TEXT;

-- Hand-written backfill: every owner who already has objects gets a
-- "3D objects" library at the end of their list, and their objects move in.
WITH owners AS (
  SELECT DISTINCT "ownerId" FROM "CustomObject3D"
), created AS (
  INSERT INTO "CustomNodeSection" ("id", "ownerId", "name", "sortOrder", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text,
         owners."ownerId",
         '3D objects',
         COALESCE((SELECT MAX(s."sortOrder") FROM "CustomNodeSection" s WHERE s."ownerId" = owners."ownerId"), -1) + 1,
         CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP
  FROM owners
  RETURNING "id", "ownerId"
)
UPDATE "CustomObject3D" o SET "sectionId" = created."id"
FROM created
WHERE created."ownerId" = o."ownerId";

ALTER TABLE "CustomObject3D" ALTER COLUMN "sectionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CustomObject3D_sectionId_idx" ON "CustomObject3D"("sectionId");

-- AddForeignKey
ALTER TABLE "CustomObject3D" ADD CONSTRAINT "CustomObject3D_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CustomNodeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
