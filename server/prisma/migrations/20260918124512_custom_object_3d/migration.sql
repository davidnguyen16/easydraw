-- CreateTable
CREATE TABLE "CustomObject3D" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipe" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomObject3D_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomObject3D_ownerId_updatedAt_idx" ON "CustomObject3D"("ownerId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "CustomObject3D" ADD CONSTRAINT "CustomObject3D_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: a name is required and bounded, as in CustomNodeSection.
ALTER TABLE "CustomObject3D"
  ADD CONSTRAINT "CustomObject3D_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100);
